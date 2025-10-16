#!/usr/bin/env python3
"""
Backend Test Suite for El Rincón del Laurel - Daily Closure Critical Testing
Testing the daily closure functionality with sales reset as requested.
"""

import requests
import json
from datetime import datetime, timedelta
import time
import sys

# Get backend URL from frontend .env
BACKEND_URL = "https://resto-manager-100.preview.emergentagent.com/api"

class DailyClosureTestSuite:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.created_orders = []  # Track orders we create for cleanup
        
    def log_test(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASSED" if passed else "❌ FAILED"
        result = f"{status} - {test_name}"
        if details:
            result += f" | {details}"
        self.test_results.append(result)
        print(result)
        
    def cleanup_existing_closures(self):
        """Clean up existing closures for today to allow fresh testing"""
        print("\n=== CLEANUP: Eliminando cierres existentes de hoy ===")
        
        try:
            # Get existing closures
            response = requests.get(f"{self.base_url}/daily-closures")
            if response.status_code != 200:
                self.log_test("Cleanup - Get Closures", False, f"Status: {response.status_code}")
                return False
            
            closures = response.json()
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Find closures from today
            today_closures = []
            for closure in closures:
                closure_date = datetime.fromisoformat(closure['date'].replace('Z', '+00:00'))
                if closure_date >= today:
                    today_closures.append(closure)
            
            print(f"Cierres de hoy encontrados: {len(today_closures)}")
            
            # Note: We can't delete closures via API, but we can document this issue
            if today_closures:
                print("⚠️  ISSUE DETECTED: Existing closures found but orders not marked as closed")
                self.log_test("Cleanup - Closure Bug Detected", False, 
                             f"Found {len(today_closures)} closures but orders still show in daily-stats")
                return False
            
            self.log_test("Cleanup - No Existing Closures", True, "Ready for fresh testing")
            return True
            
        except Exception as e:
            self.log_test("Cleanup - Exception", False, str(e))
            return False

    def setup_test_data(self):
        """Setup: Create delivered orders for testing if needed"""
        print("\n=== SETUP: Verificando pedidos entregados ===")
        
        try:
            # Get existing orders
            response = requests.get(f"{self.base_url}/orders")
            if response.status_code != 200:
                self.log_test("Setup - Get Orders", False, f"Status: {response.status_code}")
                return False
                
            orders = response.json()
            
            # Count delivered orders from today that are NOT closed
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            delivered_today = []
            
            for order in orders:
                if order.get('status') == 'entregado':
                    created_at = datetime.fromisoformat(order['created_at'].replace('Z', '+00:00'))
                    if created_at >= today and not order.get('closed_date'):
                        delivered_today.append(order)
            
            print(f"Pedidos entregados NO cerrados hoy: {len(delivered_today)}")
            
            # Create test orders if we need more
            orders_needed = max(0, 2 - len(delivered_today))
            if orders_needed > 0:
                print(f"Creando {orders_needed} pedidos de prueba...")
                
                # Get products first
                products_response = requests.get(f"{self.base_url}/products")
                if products_response.status_code != 200:
                    self.log_test("Setup - Get Products", False, f"Status: {products_response.status_code}")
                    return False
                    
                products = products_response.json()
                if len(products) < 2:
                    self.log_test("Setup - Products Available", False, "Need at least 2 products")
                    return False
                
                # Create test orders
                for i in range(orders_needed):
                    order_data = {
                        "table_number": 10 + i,
                        "zone": "terraza_exterior",
                        "waiter_role": "camarero_1",
                        "products": [
                            {
                                "product_id": products[0]["_id"],
                                "name": products[0]["name"],
                                "category": products[0]["category"],
                                "price": products[0]["price"],
                                "quantity": 2
                            },
                            {
                                "product_id": products[1]["_id"],
                                "name": products[1]["name"],
                                "category": products[1]["category"],
                                "price": products[1]["price"],
                                "quantity": 1
                            }
                        ],
                        "total": (products[0]["price"] * 2) + products[1]["price"],
                        "status": "entregado",
                        "payment_method": "efectivo"
                    }
                    
                    response = requests.post(f"{self.base_url}/orders", json=order_data)
                    if response.status_code == 200:
                        created_order = response.json()
                        self.created_orders.append(created_order["_id"])
                        print(f"Pedido creado: Mesa {order_data['table_number']}, Total: {order_data['total']}€")
                    else:
                        self.log_test(f"Setup - Create Order {i+1}", False, f"Status: {response.status_code}")
                        return False
            
            self.log_test("Setup - Test Data Ready", True, f"Pedidos entregados disponibles para testing")
            return True
            
        except Exception as e:
            self.log_test("Setup - Exception", False, str(e))
            return False
    
    def test_1_daily_stats_shows_non_closed_orders(self):
        """Test 1: Daily Stats muestra solo pedidos NO cerrados"""
        print("\n=== TEST 1: Daily Stats - Solo pedidos NO cerrados ===")
        
        try:
            response = requests.get(f"{self.base_url}/daily-stats")
            
            if response.status_code != 200:
                self.log_test("Test 1 - API Response", False, f"Status: {response.status_code}")
                return False
            
            stats = response.json()
            
            # Verify required fields
            required_fields = ['date', 'total_sales', 'total_orders', 'zone_breakdown']
            for field in required_fields:
                if field not in stats:
                    self.log_test("Test 1 - Required Fields", False, f"Missing field: {field}")
                    return False
            
            # Verify zone_breakdown structure
            zones = ['terraza_exterior', 'salon_interior', 'terraza_interior']
            zone_breakdown = stats.get('zone_breakdown', {})
            
            for zone in zones:
                if zone not in zone_breakdown:
                    self.log_test("Test 1 - Zone Breakdown", False, f"Missing zone: {zone}")
                    return False
                    
                zone_data = zone_breakdown[zone]
                if 'sales' not in zone_data or 'orders' not in zone_data:
                    self.log_test("Test 1 - Zone Data", False, f"Zone {zone} missing sales/orders")
                    return False
            
            # Store initial stats for comparison
            self.initial_stats = stats
            
            self.log_test("Test 1 - Daily Stats Structure", True, 
                         f"Total sales: {stats['total_sales']}€, Orders: {stats['total_orders']}")
            
            # Verify we have some orders to work with
            if stats['total_orders'] == 0:
                self.log_test("Test 1 - Orders Available", False, "No delivered orders found for testing")
                return False
                
            self.log_test("Test 1 - Orders Available", True, f"Found {stats['total_orders']} orders")
            return True
            
        except Exception as e:
            self.log_test("Test 1 - Exception", False, str(e))
            return False
    
    def test_2_create_first_daily_closure(self):
        """Test 2: Crear primer cierre del día"""
        print("\n=== TEST 2: Crear primer cierre diario ===")
        
        try:
            # Use the stats from test 1
            if not hasattr(self, 'initial_stats'):
                self.log_test("Test 2 - Prerequisites", False, "Test 1 must run first")
                return False
            
            stats = self.initial_stats
            
            closure_data = {
                "date": datetime.utcnow().isoformat(),
                "total_sales": stats['total_sales'],
                "cash_sales": stats.get('cash_sales', 0),
                "card_sales": stats.get('card_sales', 0),
                "mixed_sales": stats.get('mixed_sales', 0),
                "total_orders": stats['total_orders'],
                "zone_breakdown": stats['zone_breakdown'],
                "closed_by": "testing_agent"
            }
            
            response = requests.post(f"{self.base_url}/daily-closures", json=closure_data)
            
            if response.status_code != 200:
                self.log_test("Test 2 - Create Closure", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
            
            closure = response.json()
            
            # Verify closure was created correctly
            if '_id' not in closure:
                self.log_test("Test 2 - Closure ID", False, "No ID in response")
                return False
            
            self.closure_id = closure['_id']
            
            # Verify closure data
            if closure['total_sales'] != stats['total_sales']:
                self.log_test("Test 2 - Closure Data", False, f"Sales mismatch: {closure['total_sales']} vs {stats['total_sales']}")
                return False
            
            self.log_test("Test 2 - Create Closure", True, 
                         f"Closure created with ID: {self.closure_id}, Sales: {closure['total_sales']}€")
            return True
            
        except Exception as e:
            self.log_test("Test 2 - Exception", False, str(e))
            return False
    
    def test_3_verify_orders_marked_closed(self):
        """Test 3: Verificar que pedidos fueron marcados como cerrados"""
        print("\n=== TEST 3: Verificar pedidos marcados como cerrados ===")
        
        try:
            response = requests.get(f"{self.base_url}/orders")
            
            if response.status_code != 200:
                self.log_test("Test 3 - Get Orders", False, f"Status: {response.status_code}")
                return False
            
            orders = response.json()
            
            # Check delivered orders from today
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            delivered_today = []
            closed_orders = 0
            
            for order in orders:
                if order.get('status') == 'entregado':
                    created_at = datetime.fromisoformat(order['created_at'].replace('Z', '+00:00'))
                    if created_at >= today:
                        delivered_today.append(order)
                        
                        # Check if order has closed_date
                        if order.get('closed_date'):
                            closed_orders += 1
                            
                            # Verify closed_date is recent (within last 5 minutes)
                            closed_date = datetime.fromisoformat(order['closed_date'].replace('Z', '+00:00'))
                            time_diff = datetime.utcnow() - closed_date.replace(tzinfo=None)
                            
                            if time_diff > timedelta(minutes=5):
                                self.log_test("Test 3 - Closed Date Recent", False, 
                                             f"Order {order['_id']} closed_date not recent: {time_diff}")
                                return False
            
            if len(delivered_today) == 0:
                self.log_test("Test 3 - Orders Found", False, "No delivered orders found")
                return False
            
            if closed_orders != len(delivered_today):
                self.log_test("Test 3 - All Orders Closed", False, 
                             f"Only {closed_orders}/{len(delivered_today)} orders marked as closed")
                return False
            
            self.log_test("Test 3 - Orders Marked Closed", True, 
                         f"All {closed_orders} delivered orders marked with closed_date")
            return True
            
        except Exception as e:
            self.log_test("Test 3 - Exception", False, str(e))
            return False
    
    def test_4_daily_stats_now_zero(self):
        """Test 4: Daily Stats ahora retorna CERO (pedidos ya cerrados)"""
        print("\n=== TEST 4: Daily Stats debe retornar CERO ===")
        
        try:
            response = requests.get(f"{self.base_url}/daily-stats")
            
            if response.status_code != 200:
                self.log_test("Test 4 - API Response", False, f"Status: {response.status_code}")
                return False
            
            stats = response.json()
            
            # Verify all sales are zero
            if stats['total_sales'] != 0:
                self.log_test("Test 4 - Total Sales Zero", False, f"Expected 0, got {stats['total_sales']}")
                return False
            
            if stats['total_orders'] != 0:
                self.log_test("Test 4 - Total Orders Zero", False, f"Expected 0, got {stats['total_orders']}")
                return False
            
            # Verify zone breakdown is all zeros
            zone_breakdown = stats.get('zone_breakdown', {})
            for zone, data in zone_breakdown.items():
                if data.get('sales', 0) != 0:
                    self.log_test("Test 4 - Zone Sales Zero", False, f"Zone {zone} sales not zero: {data['sales']}")
                    return False
                    
                if data.get('orders', 0) != 0:
                    self.log_test("Test 4 - Zone Orders Zero", False, f"Zone {zone} orders not zero: {data['orders']}")
                    return False
            
            self.log_test("Test 4 - Stats Reset to Zero", True, 
                         "All sales and orders correctly reset to 0 after closure")
            return True
            
        except Exception as e:
            self.log_test("Test 4 - Exception", False, str(e))
            return False
    
    def test_5_duplicate_closure_fails(self):
        """Test 5: Intento de cierre duplicado debe FALLAR"""
        print("\n=== TEST 5: Cierre duplicado debe fallar ===")
        
        try:
            # Attempt to create another closure for today
            closure_data = {
                "date": datetime.utcnow().isoformat(),
                "total_sales": 100.0,
                "cash_sales": 100.0,
                "card_sales": 0.0,
                "mixed_sales": 0.0,
                "total_orders": 1,
                "zone_breakdown": {
                    "terraza_exterior": {"sales": 100.0, "orders": 1},
                    "salon_interior": {"sales": 0.0, "orders": 0},
                    "terraza_interior": {"sales": 0.0, "orders": 0}
                },
                "closed_by": "testing_agent_duplicate"
            }
            
            response = requests.post(f"{self.base_url}/daily-closures", json=closure_data)
            
            # Should return 400 error
            if response.status_code != 400:
                self.log_test("Test 5 - Duplicate Rejection", False, 
                             f"Expected 400, got {response.status_code}")
                return False
            
            # Verify error message
            error_response = response.json()
            error_message = error_response.get('detail', '')
            
            if "Ya existe un cierre para el día de hoy" not in error_message:
                self.log_test("Test 5 - Error Message", False, 
                             f"Unexpected error message: {error_message}")
                return False
            
            self.log_test("Test 5 - Duplicate Closure Blocked", True, 
                         f"Correctly rejected with: {error_message}")
            return True
            
        except Exception as e:
            self.log_test("Test 5 - Exception", False, str(e))
            return False
    
    def test_6_websocket_event_emitted(self):
        """Test 6: Evento WebSocket emitido (verificar en logs)"""
        print("\n=== TEST 6: Verificar evento WebSocket ===")
        
        try:
            # Check supervisor logs for WebSocket event
            import subprocess
            
            # Get recent backend logs
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                self.log_test("Test 6 - Log Access", False, "Could not access backend logs")
                return False
            
            logs = result.stdout
            
            # Look for daily_closure_created event
            if "daily_closure_created" in logs:
                self.log_test("Test 6 - WebSocket Event", True, 
                             "Found 'daily_closure_created' event in logs")
                return True
            else:
                # Try stderr logs too
                result_err = subprocess.run(
                    ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
                    capture_output=True,
                    text=True
                )
                
                if result_err.returncode == 0 and "daily_closure_created" in result_err.stdout:
                    self.log_test("Test 6 - WebSocket Event", True, 
                                 "Found 'daily_closure_created' event in error logs")
                    return True
                
                self.log_test("Test 6 - WebSocket Event", False, 
                             "No 'daily_closure_created' event found in logs")
                return False
            
        except Exception as e:
            self.log_test("Test 6 - Exception", False, str(e))
            return False
    
    def run_all_tests(self):
        """Run all daily closure tests"""
        print("🧪 INICIANDO TESTING CRÍTICO: Daily Closure con Reset de Ventas")
        print("=" * 70)
        
        # Check for existing closures first
        if not self.cleanup_existing_closures():
            print("\n❌ CRITICAL BUG DETECTED - Daily closure functionality is broken!")
            print("   Closures exist but orders are not marked as closed")
            return False
        
        # Setup
        if not self.setup_test_data():
            print("\n❌ SETUP FAILED - Cannot continue with tests")
            return False
        
        # Run tests in sequence
        tests = [
            self.test_1_daily_stats_shows_non_closed_orders,
            self.test_2_create_first_daily_closure,
            self.test_3_verify_orders_marked_closed,
            self.test_4_daily_stats_now_zero,
            self.test_5_duplicate_closure_fails,
            self.test_6_websocket_event_emitted
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test in tests:
            if test():
                passed_tests += 1
            else:
                print(f"\n⚠️  Test failed, but continuing with remaining tests...")
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 RESUMEN DE TESTING CRÍTICO")
        print("=" * 70)
        
        for result in self.test_results:
            print(result)
        
        print(f"\n🎯 RESULTADO FINAL: {passed_tests}/{total_tests} tests PASSED")
        
        if passed_tests == total_tests:
            print("✅ TODOS LOS TESTS CRÍTICOS PASARON - Daily Closure funcionando correctamente")
            return True
        else:
            print("❌ ALGUNOS TESTS FALLARON - Revisar implementación")
            return False

def main():
    """Main test execution"""
    test_suite = DailyClosureTestSuite()
    success = test_suite.run_all_tests()
    
    if success:
        print("\n🎉 TESTING COMPLETADO EXITOSAMENTE")
        sys.exit(0)
    else:
        print("\n💥 TESTING FALLÓ - Revisar errores arriba")
        sys.exit(1)

if __name__ == "__main__":
    main()