#!/usr/bin/env python3
"""
Backend API Testing for El Rincón del Laurel
Tests all REST API endpoints and business logic
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://laurel-sync.preview.emergentagent.com/api"
TIMEOUT = 30

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = {
            "products": {"passed": 0, "failed": 0, "errors": []},
            "orders": {"passed": 0, "failed": 0, "errors": []},
            "settings": {"passed": 0, "failed": 0, "errors": []},
            "seed": {"passed": 0, "failed": 0, "errors": []},
            "business_logic": {"passed": 0, "failed": 0, "errors": []}
        }
        self.created_products = []
        self.created_orders = []
        
    def log_result(self, category: str, test_name: str, success: bool, error: str = None):
        """Log test result"""
        if success:
            self.test_results[category]["passed"] += 1
            print(f"✅ {test_name}")
        else:
            self.test_results[category]["failed"] += 1
            self.test_results[category]["errors"].append(f"{test_name}: {error}")
            print(f"❌ {test_name}: {error}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url)
            elif method == "POST":
                response = self.session.post(url, json=data)
            elif method == "PUT":
                response = self.session.put(url, json=data)
            elif method == "DELETE":
                response = self.session.delete(url)
            
            return {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "success": 200 <= response.status_code < 300
            }
        except Exception as e:
            return {
                "status_code": 0,
                "data": {},
                "success": False,
                "error": str(e)
            }

    def test_api_root(self):
        """Test API root endpoint"""
        print("\n=== Testing API Root ===")
        result = self.make_request("GET", "/")
        
        if result["success"] and "El Rincón del Laurel API" in result["data"].get("message", ""):
            self.log_result("products", "API Root endpoint", True)
        else:
            self.log_result("products", "API Root endpoint", False, 
                          f"Status: {result['status_code']}, Response: {result.get('data', {})}")

    def test_products_crud(self):
        """Test Products CRUD operations"""
        print("\n=== Testing Products CRUD ===")
        
        # 1. GET /api/products (should return existing products)
        result = self.make_request("GET", "/products")
        if result["success"] and isinstance(result["data"], list):
            self.log_result("products", "GET /products", True)
            existing_count = len(result["data"])
            print(f"   Found {existing_count} existing products")
        else:
            self.log_result("products", "GET /products", False, 
                          f"Status: {result['status_code']}")
            return
        
        # 2. POST /api/products (create new product)
        new_product = {
            "name": "Gazpacho Andaluz",
            "category": "comida",
            "price": 7.50
        }
        
        result = self.make_request("POST", "/products", new_product)
        if result["success"] and result["data"].get("name") == new_product["name"]:
            product_id = result["data"]["_id"]
            self.created_products.append(product_id)
            self.log_result("products", "POST /products", True)
            
            # Verify datetime serialization
            if "created_at" in result["data"] and isinstance(result["data"]["created_at"], str):
                self.log_result("products", "Product datetime serialization", True)
            else:
                self.log_result("products", "Product datetime serialization", False, 
                              "created_at not properly serialized")
        else:
            self.log_result("products", "POST /products", False, 
                          f"Status: {result['status_code']}, Data: {result.get('data', {})}")
            return
        
        # 3. PUT /api/products/:id (update product)
        updated_product = {
            "name": "Gazpacho Andaluz Premium",
            "category": "comida", 
            "price": 8.50
        }
        
        result = self.make_request("PUT", f"/products/{product_id}", updated_product)
        if result["success"] and result["data"].get("name") == updated_product["name"]:
            self.log_result("products", "PUT /products/:id", True)
        else:
            self.log_result("products", "PUT /products/:id", False,
                          f"Status: {result['status_code']}")
        
        # 4. DELETE /api/products/:id
        result = self.make_request("DELETE", f"/products/{product_id}")
        if result["success"] and result["data"].get("success"):
            self.log_result("products", "DELETE /products/:id", True)
            self.created_products.remove(product_id)
        else:
            self.log_result("products", "DELETE /products/:id", False,
                          f"Status: {result['status_code']}")

    def test_orders_crud(self):
        """Test Orders CRUD operations"""
        print("\n=== Testing Orders CRUD ===")
        
        # First get some products to use in orders
        products_result = self.make_request("GET", "/products")
        if not products_result["success"] or not products_result["data"]:
            self.log_result("orders", "GET products for orders", False, "No products available")
            return
        
        available_products = products_result["data"][:2]  # Use first 2 products
        
        # 1. GET /api/orders
        result = self.make_request("GET", "/orders")
        if result["success"] and isinstance(result["data"], list):
            self.log_result("orders", "GET /orders", True)
            existing_orders = len(result["data"])
            print(f"   Found {existing_orders} existing orders")
        else:
            self.log_result("orders", "GET /orders", False,
                          f"Status: {result['status_code']}")
            return
        
        # 2. POST /api/orders (create new order)
        new_order = {
            "table_number": 5,
            "waiter_role": "camarero_1",
            "products": [
                {
                    "product_id": available_products[0]["_id"],
                    "name": available_products[0]["name"],
                    "category": available_products[0]["category"],
                    "price": available_products[0]["price"],
                    "quantity": 2,
                    "note": "Sin cebolla"
                }
            ],
            "total": available_products[0]["price"] * 2,
            "status": "pendiente",
            "special_note": "Mesa cerca de la ventana"
        }
        
        result = self.make_request("POST", "/orders", new_order)
        if result["success"] and result["data"].get("table_number") == 5:
            order_id = result["data"]["_id"]
            self.created_orders.append(order_id)
            self.log_result("orders", "POST /orders", True)
            
            # Verify datetime serialization
            if ("created_at" in result["data"] and "updated_at" in result["data"] and
                isinstance(result["data"]["created_at"], str) and 
                isinstance(result["data"]["updated_at"], str)):
                self.log_result("orders", "Order datetime serialization", True)
            else:
                self.log_result("orders", "Order datetime serialization", False,
                              "Datetime fields not properly serialized")
                
            # Verify total calculation
            expected_total = available_products[0]["price"] * 2
            if abs(result["data"]["total"] - expected_total) < 0.01:
                self.log_result("business_logic", "Order total calculation", True)
            else:
                self.log_result("business_logic", "Order total calculation", False,
                              f"Expected {expected_total}, got {result['data']['total']}")
        else:
            self.log_result("orders", "POST /orders", False,
                          f"Status: {result['status_code']}, Data: {result.get('data', {})}")
            return
        
        # 3. GET /api/orders/:id (get specific order)
        result = self.make_request("GET", f"/orders/{order_id}")
        if result["success"] and result["data"].get("_id") == order_id:
            self.log_result("orders", "GET /orders/:id", True)
        else:
            self.log_result("orders", "GET /orders/:id", False,
                          f"Status: {result['status_code']}")
        
        # 4. PUT /api/orders/:id (update order status)
        updated_order = {
            "table_number": 5,
            "waiter_role": "camarero_1", 
            "products": new_order["products"],
            "total": new_order["total"],
            "status": "en_preparacion",
            "special_note": "Mesa cerca de la ventana - Actualizado"
        }
        
        result = self.make_request("PUT", f"/orders/{order_id}", updated_order)
        if result["success"] and result["data"].get("status") == "en_preparacion":
            self.log_result("orders", "PUT /orders/:id", True)
        else:
            self.log_result("orders", "PUT /orders/:id", False,
                          f"Status: {result['status_code']}")
        
        # 5. DELETE /api/orders/:id
        result = self.make_request("DELETE", f"/orders/{order_id}")
        if result["success"] and result["data"].get("success"):
            self.log_result("orders", "DELETE /orders/:id", True)
            self.created_orders.remove(order_id)
        else:
            self.log_result("orders", "DELETE /orders/:id", False,
                          f"Status: {result['status_code']}")

    def test_order_unification_logic(self):
        """Test order unification logic for orders created within 3 minutes"""
        print("\n=== Testing Order Unification Logic ===")
        
        # Get products for testing
        products_result = self.make_request("GET", "/products")
        if not products_result["success"] or not products_result["data"]:
            self.log_result("business_logic", "Order unification - get products", False, "No products available")
            return
        
        available_products = products_result["data"][:1]  # Use first product
        
        # Create first order
        order1 = {
            "table_number": 10,
            "waiter_role": "camarero_2",
            "products": [
                {
                    "product_id": available_products[0]["_id"],
                    "name": available_products[0]["name"],
                    "category": available_products[0]["category"],
                    "price": available_products[0]["price"],
                    "quantity": 1
                }
            ],
            "total": available_products[0]["price"],
            "status": "pendiente"
        }
        
        result1 = self.make_request("POST", "/orders", order1)
        if not result1["success"]:
            self.log_result("business_logic", "Order unification - create first order", False,
                          f"Status: {result1['status_code']}")
            return
        
        order1_id = result1["data"]["_id"]
        self.created_orders.append(order1_id)
        
        # Wait a moment then create second order with same product (should be unified)
        time.sleep(1)
        
        order2 = {
            "table_number": 11,
            "waiter_role": "camarero_2",
            "products": [
                {
                    "product_id": available_products[0]["_id"],
                    "name": available_products[0]["name"],
                    "category": available_products[0]["category"],
                    "price": available_products[0]["price"],
                    "quantity": 2
                }
            ],
            "total": available_products[0]["price"] * 2,
            "status": "pendiente"
        }
        
        result2 = self.make_request("POST", "/orders", order2)
        if result2["success"]:
            order2_id = result2["data"]["_id"]
            self.created_orders.append(order2_id)
            
            # Check if unified_with field is populated
            if "unified_with" in result2["data"] and result2["data"]["unified_with"]:
                if order1_id in result2["data"]["unified_with"]:
                    self.log_result("business_logic", "Order unification logic", True)
                else:
                    self.log_result("business_logic", "Order unification logic", False,
                                  f"Order1 ID {order1_id} not found in unified_with: {result2['data']['unified_with']}")
            else:
                self.log_result("business_logic", "Order unification logic", False,
                              "unified_with field not populated or empty")
        else:
            self.log_result("business_logic", "Order unification - create second order", False,
                          f"Status: {result2['status_code']}")

    def test_settings_api(self):
        """Test Settings API"""
        print("\n=== Testing Settings API ===")
        
        # 1. GET /api/settings
        result = self.make_request("GET", "/settings")
        if result["success"]:
            self.log_result("settings", "GET /settings", True)
            
            # Verify structure
            settings_data = result["data"]
            if ("onesignal_app_id" in settings_data and 
                "onesignal_api_key" in settings_data and
                "updated_at" in settings_data):
                self.log_result("settings", "Settings structure validation", True)
            else:
                self.log_result("settings", "Settings structure validation", False,
                              f"Missing required fields in: {settings_data}")
        else:
            self.log_result("settings", "GET /settings", False,
                          f"Status: {result['status_code']}")
            return
        
        # 2. PUT /api/settings
        new_settings = {
            "onesignal_app_id": "test-app-id-12345",
            "onesignal_api_key": "test-api-key-67890"
        }
        
        result = self.make_request("PUT", "/settings", new_settings)
        if result["success"]:
            updated_data = result["data"]
            if (updated_data.get("onesignal_app_id") == new_settings["onesignal_app_id"] and
                updated_data.get("onesignal_api_key") == new_settings["onesignal_api_key"]):
                self.log_result("settings", "PUT /settings", True)
                
                # Verify updated_at timestamp
                if "updated_at" in updated_data and isinstance(updated_data["updated_at"], str):
                    self.log_result("settings", "Settings datetime serialization", True)
                else:
                    self.log_result("settings", "Settings datetime serialization", False,
                                  "updated_at not properly serialized")
            else:
                self.log_result("settings", "PUT /settings", False,
                              "Settings not properly updated")
        else:
            self.log_result("settings", "PUT /settings", False,
                          f"Status: {result['status_code']}")

    def test_seed_data(self):
        """Test Seed Data API"""
        print("\n=== Testing Seed Data API ===")
        
        # Check current product count
        products_result = self.make_request("GET", "/products")
        if not products_result["success"]:
            self.log_result("seed", "GET products before seed", False,
                          f"Status: {products_result['status_code']}")
            return
        
        initial_count = len(products_result["data"])
        
        # POST /api/seed
        result = self.make_request("POST", "/seed")
        if result["success"]:
            message = result["data"].get("message", "")
            
            if "already seeded" in message:
                self.log_result("seed", "POST /seed (duplicate prevention)", True)
                print("   Seed data already exists - duplicate prevention working")
            elif "seeded successfully" in message:
                self.log_result("seed", "POST /seed (new data)", True)
                
                # Verify products were actually added
                new_products_result = self.make_request("GET", "/products")
                if new_products_result["success"]:
                    new_count = len(new_products_result["data"])
                    if new_count > initial_count:
                        self.log_result("seed", "Seed data verification", True)
                        print(f"   Added {new_count - initial_count} products")
                    else:
                        self.log_result("seed", "Seed data verification", False,
                                      "No new products found after seeding")
            else:
                self.log_result("seed", "POST /seed", False,
                              f"Unexpected response: {message}")
        else:
            self.log_result("seed", "POST /seed", False,
                          f"Status: {result['status_code']}")

    def cleanup_test_data(self):
        """Clean up any test data created during testing"""
        print("\n=== Cleaning up test data ===")
        
        # Delete created orders
        for order_id in self.created_orders[:]:
            result = self.make_request("DELETE", f"/orders/{order_id}")
            if result["success"]:
                self.created_orders.remove(order_id)
                print(f"   Deleted order {order_id}")
        
        # Delete created products  
        for product_id in self.created_products[:]:
            result = self.make_request("DELETE", f"/products/{product_id}")
            if result["success"]:
                self.created_products.remove(product_id)
                print(f"   Deleted product {product_id}")

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend API Tests for El Rincón del Laurel")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # Test API availability
            self.test_api_root()
            
            # Test all endpoints
            self.test_products_crud()
            self.test_orders_crud()
            self.test_order_unification_logic()
            self.test_settings_api()
            self.test_seed_data()
            
        finally:
            # Always cleanup
            self.cleanup_test_data()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("📊 TEST RESULTS SUMMARY")
        print("="*60)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.test_results.items():
            passed = results["passed"]
            failed = results["failed"]
            total_passed += passed
            total_failed += failed
            
            status = "✅" if failed == 0 else "❌"
            print(f"{status} {category.upper()}: {passed} passed, {failed} failed")
            
            if results["errors"]:
                for error in results["errors"]:
                    print(f"   ❌ {error}")
        
        print("-" * 60)
        print(f"🎯 TOTAL: {total_passed} passed, {total_failed} failed")
        
        if total_failed == 0:
            print("🎉 ALL TESTS PASSED!")
        else:
            print(f"⚠️  {total_failed} TESTS FAILED - See details above")
        
        print(f"⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()