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
from typing import List, Optional, Dict
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

class Product(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    name: str
    category: str  # comida, bebida, postre
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
    quantity: int = 1
    note: Optional[str] = None

class Order(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    table_number: int
    waiter_role: str  # "barra", "camarero_1", "camarero_2"
    products: List[OrderProduct]
    total: float
    status: str = "pendiente"  # pendiente, en_preparacion, listo, entregado
    payment_method: Optional[str] = None  # efectivo, tarjeta, ambos
    partial_payments: List[Dict] = []
    special_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    unified_with: Optional[List[str]] = []  # IDs de pedidos unificados

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
        
        # Convert ObjectId to string
        for order in orders:
            order['_id'] = str(order['_id'])
            order['created_at'] = order['created_at'].isoformat()
            order['updated_at'] = order['updated_at'].isoformat()
        
        for product in products:
            product['_id'] = str(product['_id'])
            product['created_at'] = product['created_at'].isoformat()
        
        await sio.emit('sync_data', {
            'orders': orders,
            'products': products
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
    return doc

async def find_similar_orders(order_data: Dict) -> List[Dict]:
    """Find orders created within 3 minutes with same products"""
    three_minutes_ago = datetime.utcnow() - timedelta(minutes=3)
    
    # Get recent pending orders
    recent_orders = await db.orders.find({
        'created_at': {'$gte': three_minutes_ago},
        'status': 'pendiente'
    }).to_list(100)
    
    similar_orders = []
    order_products = set(p['product_id'] for p in order_data['products'])
    
    for order in recent_orders:
        existing_products = set(p['product_id'] for p in order['products'])
        # Check if there's any overlap in products
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
        
        # This would integrate with OneSignal API
        # For now, we'll emit a socket event
        await sio.emit('notification', {
            'role': waiter_role,
            'order_id': order_id,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Notification error: {str(e)}")

# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "El Rincón del Laurel API", "status": "running"}

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
        
        # Broadcast to all connected clients
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
        
        # Broadcast to all connected clients
        await sio.emit('product_updated', serialize_doc(product_dict))
        
        return serialize_doc(product_dict)
    except Exception as e:
        logger.error(f"Error updating product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    try:
        await db.products.delete_one({"_id": ObjectId(product_id)})
        
        # Broadcast to all connected clients
        await sio.emit('product_deleted', {'product_id': product_id})
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ORDERS =====

@api_router.get("/orders")
async def get_orders():
    try:
        orders = await db.orders.find().sort('created_at', -1).to_list(1000)
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
        
        # Find similar orders for unification
        similar_orders = await find_similar_orders(order_dict)
        if similar_orders:
            order_dict['unified_with'] = [str(o['_id']) for o in similar_orders]
        
        result = await db.orders.insert_one(order_dict)
        order_dict['_id'] = str(result.inserted_id)
        
        # Broadcast to all connected clients
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
        
        # Get the old order to check status change
        old_order = await db.orders.find_one({"_id": ObjectId(order_id)})
        
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": order_dict}
        )
        order_dict['_id'] = order_id
        
        # If status changed to "listo", send notification
        if old_order and old_order.get('status') != 'listo' and order_dict.get('status') == 'listo':
            waiter_role = order_dict.get('waiter_role')
            await send_notification(waiter_role, order_id, f"Pedido mesa {order_dict['table_number']} listo")
        
        # Broadcast to all connected clients
        await sio.emit('order_updated', serialize_doc(order_dict))
        
        return serialize_doc(order_dict)
    except Exception as e:
        logger.error(f"Error updating order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    try:
        await db.orders.delete_one({"_id": ObjectId(order_id)})
        
        # Broadcast to all connected clients
        await sio.emit('order_deleted', {'order_id': order_id})
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== SETTINGS =====

@api_router.get("/settings")
async def get_settings():
    try:
        settings = await db.settings.find_one()
        if not settings:
            # Create default settings
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
        # Check if products exist
        count = await db.products.count_documents({})
        if count > 0:
            return {"message": "Data already seeded"}
        
        # Sample products
        sample_products = [
            # Comidas
            {"name": "Paella Valenciana", "category": "comida", "price": 15.50, "created_at": datetime.utcnow()},
            {"name": "Tortilla Española", "category": "comida", "price": 8.00, "created_at": datetime.utcnow()},
            {"name": "Jamón Ibérico", "category": "comida", "price": 18.00, "created_at": datetime.utcnow()},
            {"name": "Croquetas Caseras", "category": "comida", "price": 9.50, "created_at": datetime.utcnow()},
            {"name": "Pulpo a la Gallega", "category": "comida", "price": 16.00, "created_at": datetime.utcnow()},
            
            # Bebidas
            {"name": "Vino Tinto Rioja", "category": "bebida", "price": 3.50, "created_at": datetime.utcnow()},
            {"name": "Cerveza Estrella", "category": "bebida", "price": 2.50, "created_at": datetime.utcnow()},
            {"name": "Agua Mineral", "category": "bebida", "price": 1.50, "created_at": datetime.utcnow()},
            {"name": "Sangría", "category": "bebida", "price": 4.00, "created_at": datetime.utcnow()},
            {"name": "Café Solo", "category": "bebida", "price": 1.20, "created_at": datetime.utcnow()},
            
            # Postres
            {"name": "Tarta de Santiago", "category": "postre", "price": 5.50, "created_at": datetime.utcnow()},
            {"name": "Flan Casero", "category": "postre", "price": 4.50, "created_at": datetime.utcnow()},
            {"name": "Churros con Chocolate", "category": "postre", "price": 6.00, "created_at": datetime.utcnow()},
            {"name": "Helado Artesano", "category": "postre", "price": 4.00, "created_at": datetime.utcnow()},
        ]
        
        await db.products.insert_many(sample_products)
        
        return {"message": "Data seeded successfully", "products_count": len(sample_products)}
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
