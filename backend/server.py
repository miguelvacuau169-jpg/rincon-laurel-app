from fastapi import FastAPI, APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

class Category(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    name: str
    icon: Optional[str] = "restaurant"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True

class Product(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    name: str
    category: str
    price: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True

class OrderProduct(BaseModel):
    product_id: str
    name: str
    category: str
    price: float
    original_price: Optional[float] = None
    quantity: int = 1
    note: Optional[str] = None
    is_paid: bool = False

class PartialPayment(BaseModel):
    amount: float
    payment_method: str
    paid_products: List[str] = []
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    note: Optional[str] = None

class Order(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    table_number: int
    zone: str  # terraza_exterior, salon_interior, terraza_interior
    waiter_role: str  # barra, camarero_1, camarero_2, administrador
    products: List[OrderProduct]
    total: float
    paid_amount: float = 0.0
    pending_amount: float = 0.0
    status: str = "pendiente"
    payment_method: Optional[str] = None  # efectivo, tarjeta, ambos
    partial_payments: List[PartialPayment] = []
    special_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    unified_with: Optional[List[str]] = []

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True

class DailyClosure(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    date: datetime
    total_sales: float
    cash_sales: float
    card_sales: float
    mixed_sales: float
    total_orders: int
    closed_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True

class Settings(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    onesignal_app_id: Optional[str] = None
    onesignal_api_key: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True

# ==================== SOCKET.IO EVENTS ====================

connected_clients = {}

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    connected_clients[sid] = {"role": None}
    await sio.emit('connection_established', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    if sid in connected_clients:
        del connected_clients[sid]

@sio.event
async def set_role(sid, data):
    role = data.get('role')
    connected_clients[sid] = {"role": role}
    logger.info(f"Client {sid} set role: {role}")

@sio.event
async def sync_request(sid, data):
    """Client requests full sync"""
    try:
        orders = await db.orders.find().to_list(1000)
        products = await db.products.find().to_list(1000)
        categories = await db.categories.find().to_list(1000)
        
        for order in orders:
            order['_id'] = str(order['_id'])
            order['created_at'] = order['created_at'].isoformat()
            order['updated_at'] = order['updated_at'].isoformat()
        
        for product in products:
            product['_id'] = str(product['_id'])
            product['created_at'] = product['created_at'].isoformat()
        
        for category in categories:
            category['_id'] = str(category['_id'])
            category['created_at'] = category['created_at'].isoformat()
        
        await sio.emit('sync_data', {
            'orders': orders,
            'products': products,
            'categories': categories
        }, room=sid)
    except Exception as e:
        logger.error(f"Sync error: {str(e)}")

# ==================== HELPER FUNCTIONS ====================

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    if '_id' in doc:
        doc['_id'] = str(doc['_id'])
    if 'created_at' in doc and isinstance(doc['created_at'], datetime):
        doc['created_at'] = doc['created_at'].isoformat()
    if 'updated_at' in doc and isinstance(doc['updated_at'], datetime):
        doc['updated_at'] = doc['updated_at'].isoformat()
    if 'date' in doc and isinstance(doc['date'], datetime):
        doc['date'] = doc['date'].isoformat()
    if 'partial_payments' in doc:
        for payment in doc['partial_payments']:
            if 'timestamp' in payment and isinstance(payment['timestamp'], datetime):
                payment['timestamp'] = payment['timestamp'].isoformat()
    return doc

async def find_similar_orders(order_data: Dict) -> List[Dict]:
    """Find orders created within 3 minutes with same products"""
    three_minutes_ago = datetime.utcnow() - timedelta(minutes=3)
    
    recent_orders = await db.orders.find({
        'created_at': {'$gte': three_minutes_ago},
        'status': 'pendiente'
    }).to_list(100)
    
    similar_orders = []
    order_products = set(p['product_id'] for p in order_data['products'])
    
    for order in recent_orders:
        existing_products = set(p['product_id'] for p in order['products'])
        if order_products & existing_products:
            similar_orders.append(order)
    
    return similar_orders

async def send_notification(waiter_role: str, order_id: str, message: str):
    """Send OneSignal notification to specific waiter"""
    try:
        settings = await db.settings.find_one()
        if not settings or not settings.get('onesignal_app_id') or not settings.get('onesignal_api_key'):
            logger.warning("OneSignal not configured")
            return
        
        await sio.emit('notification', {
            'role': waiter_role,
            'order_id': order_id,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Notification error: {str(e)}")

def calculate_order_amounts(order: Dict) -> Dict:
    """Calculate total, paid and pending amounts"""
    total = sum(p['price'] * p['quantity'] for p in order['products'])
    paid_amount = sum(payment['amount'] for payment in order.get('partial_payments', []))
    pending_amount = max(0, total - paid_amount)
    
    return {
        'total': round(total, 2),
        'paid_amount': round(paid_amount, 2),
        'pending_amount': round(pending_amount, 2)
    }

# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "El Rincón del Laurel API", "status": "running", "version": "2.0"}

# ===== CATEGORIES =====

@api_router.get("/categories")
async def get_categories():
    try:
        categories = await db.categories.find().to_list(1000)
        return [serialize_doc(c) for c in categories]
    except Exception as e:
        logger.error(f"Error fetching categories: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/categories")
async def create_category(category: Category):
    try:
        category_dict = category.model_dump(by_alias=True, exclude=['id'])
        result = await db.categories.insert_one(category_dict)
        category_dict['_id'] = str(result.inserted_id)
        
        await sio.emit('category_created', serialize_doc(category_dict))
        
        return serialize_doc(category_dict)
    except Exception as e:
        logger.error(f"Error creating category: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, category: Category):
    try:
        category_dict = category.model_dump(by_alias=True, exclude=['id'])
        await db.categories.update_one(
            {"_id": ObjectId(category_id)},
            {"$set": category_dict}
        )
        category_dict['_id'] = category_id
        
        await sio.emit('category_updated', serialize_doc(category_dict))
        
        return serialize_doc(category_dict)
    except Exception as e:
        logger.error(f"Error updating category: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    try:
        await db.categories.delete_one({"_id": ObjectId(category_id)})
        
        await sio.emit('category_deleted', {'category_id': category_id})
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting category: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== PRODUCTS =====

@api_router.get("/products")
async def get_products():
    try:
        products = await db.products.find().to_list(1000)
        return [serialize_doc(p) for p in products]
    except Exception as e:
        logger.error(f"Error fetching products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/products")
async def create_product(product: Product):
    try:
        product_dict = product.model_dump(by_alias=True, exclude=['id'])
        result = await db.products.insert_one(product_dict)
        product_dict['_id'] = str(result.inserted_id)
        
        await sio.emit('product_created', serialize_doc(product_dict))
        
        return serialize_doc(product_dict)
    except Exception as e:
        logger.error(f"Error creating product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: Product):
    try:
        product_dict = product.model_dump(by_alias=True, exclude=['id'])
        await db.products.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": product_dict}
        )
        product_dict['_id'] = product_id
        
        await sio.emit('product_updated', serialize_doc(product_dict))
        
        return serialize_doc(product_dict)
    except Exception as e:
        logger.error(f"Error updating product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    try:
        await db.products.delete_one({"_id": ObjectId(product_id)})
        
        await sio.emit('product_deleted', {'product_id': product_id})
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ORDERS =====

@api_router.get("/orders")
async def get_orders(zone: Optional[str] = None):
    try:
        query = {}
        if zone:
            query['zone'] = zone
            
        orders = await db.orders.find(query).sort('created_at', -1).to_list(1000)
        return [serialize_doc(o) for o in orders]
    except Exception as e:
        logger.error(f"Error fetching orders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return serialize_doc(order)
    except Exception as e:
        logger.error(f"Error fetching order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/orders")
async def create_order(order: Order):
    try:
        order_dict = order.model_dump(by_alias=True, exclude=['id'])
        order_dict['created_at'] = datetime.utcnow()
        order_dict['updated_at'] = datetime.utcnow()
        
        # Set original_price for all products
        for product in order_dict['products']:
            if 'original_price' not in product:
                product['original_price'] = product['price']
            if 'is_paid' not in product:
                product['is_paid'] = False
        
        # Calculate amounts
        amounts = calculate_order_amounts(order_dict)
        order_dict.update(amounts)
        
        # Find similar orders
        similar_orders = await find_similar_orders(order_dict)
        if similar_orders:
            order_dict['unified_with'] = [str(o['_id']) for o in similar_orders]
        
        result = await db.orders.insert_one(order_dict)
        order_dict['_id'] = str(result.inserted_id)
        
        await sio.emit('order_created', serialize_doc(order_dict))
        
        return serialize_doc(order_dict)
    except Exception as e:
        logger.error(f"Error creating order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/orders/{order_id}")
async def update_order(order_id: str, order: Order):
    try:
        order_dict = order.model_dump(by_alias=True, exclude=['id'])
        order_dict['updated_at'] = datetime.utcnow()
        
        # Recalculate amounts
        amounts = calculate_order_amounts(order_dict)
        order_dict.update(amounts)
        
        old_order = await db.orders.find_one({"_id": ObjectId(order_id)})
        
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": order_dict}
        )
        order_dict['_id'] = order_id
        
        # Send notification if status changed to listo
        if old_order and old_order.get('status') != 'listo' and order_dict.get('status') == 'listo':
            waiter_role = order_dict.get('waiter_role')
            await send_notification(waiter_role, order_id, f"Pedido mesa {order_dict['table_number']} listo")
        
        await sio.emit('order_updated', serialize_doc(order_dict))
        
        return serialize_doc(order_dict)
    except Exception as e:
        logger.error(f"Error updating order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/orders/{order_id}/partial-payment")
async def add_partial_payment(order_id: str, payment: PartialPayment):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        payment_dict = payment.model_dump()
        payment_dict['timestamp'] = datetime.utcnow()
        
        # Mark products as paid
        for product in order['products']:
            if product['product_id'] in payment_dict['paid_products']:
                product['is_paid'] = True
        
        order['partial_payments'].append(payment_dict)
        
        # Recalculate amounts
        amounts = calculate_order_amounts(order)
        order.update(amounts)
        
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {
                "products": order['products'],
                "partial_payments": order['partial_payments'],
                "paid_amount": order['paid_amount'],
                "pending_amount": order['pending_amount'],
                "updated_at": datetime.utcnow()
            }}
        )
        
        updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
        
        await sio.emit('order_updated', serialize_doc(updated_order))
        
        return serialize_doc(updated_order)
    except Exception as e:
        logger.error(f"Error adding partial payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    try:
        await db.orders.delete_one({"_id": ObjectId(order_id)})
        
        await sio.emit('order_deleted', {'order_id': order_id})
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== DAILY CLOSURE =====

@api_router.get("/daily-stats")
async def get_daily_stats(date: Optional[str] = None):
    try:
        if date:
            target_date = datetime.fromisoformat(date)
        else:
            target_date = datetime.utcnow()
        
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        orders = await db.orders.find({
            'created_at': {'$gte': start_of_day, '$lte': end_of_day},
            'status': 'entregado'
        }).to_list(1000)
        
        total_sales = 0
        cash_sales = 0
        card_sales = 0
        mixed_sales = 0
        
        for order in orders:
            # Si está entregado, usar el total (asumimos que está pagado completamente)
            amount = order.get('total', 0)
            total_sales += amount
            
            payment_method = order.get('payment_method', '')
            if payment_method == 'efectivo':
                cash_sales += amount
            elif payment_method == 'tarjeta':
                card_sales += amount
            elif payment_method == 'ambos':
                mixed_sales += amount
        
        return {
            'date': target_date.isoformat(),
            'total_sales': round(total_sales, 2),
            'cash_sales': round(cash_sales, 2),
            'card_sales': round(card_sales, 2),
            'mixed_sales': round(mixed_sales, 2),
            'total_orders': len(orders)
        }
    except Exception as e:
        logger.error(f"Error getting daily stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/daily-closures")
async def create_daily_closure(closure: DailyClosure):
    try:
        closure_dict = closure.model_dump(by_alias=True, exclude=['id'])
        closure_dict['created_at'] = datetime.utcnow()
        
        result = await db.daily_closures.insert_one(closure_dict)
        closure_dict['_id'] = str(result.inserted_id)
        
        return serialize_doc(closure_dict)
    except Exception as e:
        logger.error(f"Error creating daily closure: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/daily-closures")
async def get_daily_closures(limit: int = 30):
    try:
        closures = await db.daily_closures.find().sort('date', -1).limit(limit).to_list(limit)
        return [serialize_doc(c) for c in closures]
    except Exception as e:
        logger.error(f"Error fetching daily closures: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== SETTINGS =====

@api_router.get("/settings")
async def get_settings():
    try:
        settings = await db.settings.find_one()
        if not settings:
            settings = {
                'onesignal_app_id': None,
                'onesignal_api_key': None,
                'updated_at': datetime.utcnow()
            }
            result = await db.settings.insert_one(settings)
            settings['_id'] = str(result.inserted_id)
            return serialize_doc(settings)
        return serialize_doc(settings)
    except Exception as e:
        logger.error(f"Error fetching settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/settings")
async def update_settings(settings_data: dict = Body(...)):
    try:
        settings_data['updated_at'] = datetime.utcnow()
        
        existing = await db.settings.find_one()
        if existing:
            await db.settings.update_one(
                {"_id": existing['_id']},
                {"$set": settings_data}
            )
            settings_data['_id'] = str(existing['_id'])
        else:
            result = await db.settings.insert_one(settings_data)
            settings_data['_id'] = str(result.inserted_id)
        
        return serialize_doc(settings_data)
    except Exception as e:
        logger.error(f"Error updating settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== SEED DATA =====

@api_router.post("/seed")
async def seed_data():
    try:
        # Check if data exists
        product_count = await db.products.count_documents({})
        category_count = await db.categories.count_documents({})
        
        if product_count > 0 and category_count > 0:
            return {"message": "Data already seeded"}
        
        categories_count = 0
        products_count = 0
        
        # Seed categories
        if category_count == 0:
            categories = [
                {"name": "Entrantes", "icon": "restaurant", "created_at": datetime.utcnow()},
                {"name": "Comidas", "icon": "pizza", "created_at": datetime.utcnow()},
                {"name": "Carnes", "icon": "nutrition", "created_at": datetime.utcnow()},
                {"name": "Pescados", "icon": "fish", "created_at": datetime.utcnow()},
                {"name": "Bebidas", "icon": "beer", "created_at": datetime.utcnow()},
                {"name": "Postres", "icon": "ice-cream", "created_at": datetime.utcnow()},
            ]
            await db.categories.insert_many(categories)
            categories_count = len(categories)
        
        # Seed products
        if product_count == 0:
            sample_products = [
                # Entrantes
                {"name": "Jamón Ibérico", "category": "Entrantes", "price": 18.00, "created_at": datetime.utcnow()},
                {"name": "Croquetas Caseras", "category": "Entrantes", "price": 9.50, "created_at": datetime.utcnow()},
                
                # Comidas
                {"name": "Paella Valenciana", "category": "Comidas", "price": 15.50, "created_at": datetime.utcnow()},
                {"name": "Tortilla Española", "category": "Comidas", "price": 8.00, "created_at": datetime.utcnow()},
                
                # Carnes
                {"name": "Solomillo al Whisky", "category": "Carnes", "price": 22.00, "created_at": datetime.utcnow()},
                {"name": "Entrecot a la Brasa", "category": "Carnes", "price": 19.50, "created_at": datetime.utcnow()},
                
                # Pescados
                {"name": "Pulpo a la Gallega", "category": "Pescados", "price": 16.00, "created_at": datetime.utcnow()},
                {"name": "Merluza a la Plancha", "category": "Pescados", "price": 14.50, "created_at": datetime.utcnow()},
                
                # Bebidas
                {"name": "Vino Tinto Rioja", "category": "Bebidas", "price": 3.50, "created_at": datetime.utcnow()},
                {"name": "Cerveza Estrella", "category": "Bebidas", "price": 2.50, "created_at": datetime.utcnow()},
                {"name": "Agua Mineral", "category": "Bebidas", "price": 1.50, "created_at": datetime.utcnow()},
                {"name": "Sangría", "category": "Bebidas", "price": 4.00, "created_at": datetime.utcnow()},
                {"name": "Café Solo", "category": "Bebidas", "price": 1.20, "created_at": datetime.utcnow()},
                
                # Postres
                {"name": "Tarta de Santiago", "category": "Postres", "price": 5.50, "created_at": datetime.utcnow()},
                {"name": "Flan Casero", "category": "Postres", "price": 4.50, "created_at": datetime.utcnow()},
                {"name": "Churros con Chocolate", "category": "Postres", "price": 6.00, "created_at": datetime.utcnow()},
                {"name": "Helado Artesano", "category": "Postres", "price": 4.00, "created_at": datetime.utcnow()},
            ]
            
            await db.products.insert_many(sample_products)
            products_count = len(sample_products)
        
        return {"message": "Data seeded successfully", "products_count": products_count, "categories_count": categories_count}
    except Exception as e:
        logger.error(f"Error seeding data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
