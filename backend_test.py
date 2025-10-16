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

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = {
            "daily_stats": {"passed": 0, "failed": 0, "errors": []},
            "weekly_stats": {"passed": 0, "failed": 0, "errors": []},
            "daily_closures": {"passed": 0, "failed": 0, "errors": []},
            "test_data": {"passed": 0, "failed": 0, "errors": []}
        }
        self.created_orders = []
        self.created_closures = []
        
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

    def create_test_order_if_needed(self):
        """Create a test order with 'entregado' status if none exist for testing stats"""
        print("\n=== Checking for Test Data ===")
        
        # Check if there are any delivered orders
        result = self.make_request("GET", "/orders")
        if not result["success"]:
            self.log_result("test_data", "Check existing orders", False, f"Status: {result['status_code']}")
            return
        
        orders = result["data"]
        delivered_orders = [o for o in orders if o.get('status') == 'entregado']
        
        if delivered_orders:
            print(f"   Found {len(delivered_orders)} delivered orders for testing")
            self.log_result("test_data", "Existing delivered orders", True)
            return
        
        print("   No delivered orders found, creating test order...")
        
        # Get products for test order
        products_result = self.make_request("GET", "/products")
        if not products_result["success"] or not products_result["data"]:
            self.log_result("test_data", "Get products for test order", False, "No products available")
            return
        
        products = products_result["data"]
        
        # Create test order with 'entregado' status
        test_order = {
            "table_number": 5,
            "zone": "terraza_exterior",
            "waiter_role": "camarero_1",
            "products": [
                {
                    "product_id": products[0]['_id'],
                    "name": products[0]['name'],
                    "category": products[0]['category'],
                    "price": products[0]['price'],
                    "quantity": 2,
                    "is_paid": True
                }
            ],
            "total": products[0]['price'] * 2,
            "status": "entregado",
            "payment_method": "efectivo"
        }
        
        create_result = self.make_request("POST", "/orders", test_order)
        if create_result["success"]:
            self.created_orders.append(create_result["data"]["_id"])
            self.log_result("test_data", "Created test order", True)
            print("   Created test order with 'entregado' status for stats testing")
        else:
            self.log_result("test_data", "Create test order", False, f"Status: {create_result['status_code']}")

    def test_daily_stats_with_zones(self):
        """Test GET /api/daily-stats endpoint with zone breakdown"""
        print("\n=== Testing Daily Stats with Zone Breakdown ===")
        
        # Test 1: Get daily stats
        result = self.make_request("GET", "/daily-stats")
        if not result["success"]:
            self.log_result("daily_stats", "API Connection", False, f"Status: {result['status_code']}")
            return
        
        self.log_result("daily_stats", "API Connection", True)
        data = result["data"]
        
        # Test 2: Check required fields
        required_fields = ['date', 'total_sales', 'cash_sales', 'card_sales', 'mixed_sales', 'total_orders', 'zone_breakdown']
        for field in required_fields:
            if field not in data:
                self.log_result("daily_stats", f"Required field {field}", False, f"Missing field: {field}")
            else:
                self.log_result("daily_stats", f"Required field {field}", True)
        
        # Test 3: Check zone_breakdown structure
        if 'zone_breakdown' in data:
            zone_breakdown = data['zone_breakdown']
            expected_zones = ['terraza_exterior', 'salon_interior', 'terraza_interior']
            
            for zone in expected_zones:
                if zone not in zone_breakdown:
                    self.log_result("daily_stats", f"Zone {zone} exists", False, f"Missing zone: {zone}")
                else:
                    zone_data = zone_breakdown[zone]
                    if 'sales' not in zone_data or 'orders' not in zone_data:
                        self.log_result("daily_stats", f"Zone {zone} structure", False, f"Zone {zone} missing sales/orders fields")
                    else:
                        self.log_result("daily_stats", f"Zone {zone} structure", True)
        
        # Test 4: Check data types
        if 'total_sales' in data and isinstance(data['total_sales'], (int, float)):
            self.log_result("daily_stats", "Numeric data types", True)
        else:
            self.log_result("daily_stats", "Numeric data types", False, "total_sales should be numeric")
        
        print(f"   Daily Stats Response: {json.dumps(data, indent=2)}")

    def test_weekly_stats(self):
        """Test GET /api/weekly-stats endpoint"""
        print("\n=== Testing Weekly Stats ===")
        
        # Test 1: Get weekly stats
        result = self.make_request("GET", "/weekly-stats")
        if not result["success"]:
            self.log_result("weekly_stats", "API Connection", False, f"Status: {result['status_code']}")
            return
        
        self.log_result("weekly_stats", "API Connection", True)
        data = result["data"]
        
        # Test 2: Check required fields
        required_fields = ['period_start', 'period_end', 'total_sales', 'cash_sales', 'card_sales', 'mixed_sales', 'total_orders', 'zone_breakdown', 'daily_breakdown']
        for field in required_fields:
            if field not in data:
                self.log_result("weekly_stats", f"Required field {field}", False, f"Missing field: {field}")
            else:
                self.log_result("weekly_stats", f"Required field {field}", True)
        
        # Test 3: Check date range (should be 7 days)
        if 'period_start' in data and 'period_end' in data:
            try:
                start_date = datetime.fromisoformat(data['period_start'].replace('Z', '+00:00'))
                end_date = datetime.fromisoformat(data['period_end'].replace('Z', '+00:00'))
                date_diff = (end_date - start_date).days
                
                if date_diff >= 6 and date_diff <= 8:  # Allow some flexibility
                    self.log_result("weekly_stats", "Date range validation", True)
                else:
                    self.log_result("weekly_stats", "Date range validation", False, f"Expected ~7 days, got {date_diff} days")
            except Exception as e:
                self.log_result("weekly_stats", "Date parsing", False, f"Error parsing dates: {e}")
        
        # Test 4: Check zone_breakdown structure (same as daily)
        if 'zone_breakdown' in data:
            zone_breakdown = data['zone_breakdown']
            expected_zones = ['terraza_exterior', 'salon_interior', 'terraza_interior']
            
            for zone in expected_zones:
                if zone not in zone_breakdown:
                    self.log_result("weekly_stats", f"Zone {zone} exists", False, f"Missing zone: {zone}")
                else:
                    zone_data = zone_breakdown[zone]
                    if 'sales' not in zone_data or 'orders' not in zone_data:
                        self.log_result("weekly_stats", f"Zone {zone} structure", False, f"Zone {zone} missing sales/orders fields")
                    else:
                        self.log_result("weekly_stats", f"Zone {zone} structure", True)
        
        # Test 5: Check daily_breakdown structure
        if 'daily_breakdown' in data:
            daily_breakdown = data['daily_breakdown']
            if isinstance(daily_breakdown, dict):
                self.log_result("weekly_stats", "Daily breakdown type", True)
                # Check if dates are in YYYY-MM-DD format
                for date_key in list(daily_breakdown.keys())[:3]:  # Check first 3 dates
                    try:
                        datetime.strptime(date_key, '%Y-%m-%d')
                        day_data = daily_breakdown[date_key]
                        if 'sales' in day_data and 'orders' in day_data:
                            self.log_result("weekly_stats", f"Daily {date_key} structure", True)
                        else:
                            self.log_result("weekly_stats", f"Daily {date_key} structure", False, f"Day {date_key} missing sales/orders")
                    except ValueError:
                        self.log_result("weekly_stats", f"Date format {date_key}", False, f"Invalid date format: {date_key}")
            else:
                self.log_result("weekly_stats", "Daily breakdown type", False, "daily_breakdown should be a dict")
        
        print(f"   Weekly Stats Response: {json.dumps(data, indent=2)}")

    def test_daily_closures_auto_delete(self):
        """Test POST /api/daily-closures with auto-delete functionality"""
        print("\n=== Testing Daily Closures Auto-Delete ===")
        
        # First, check existing closures
        result = self.make_request("GET", "/daily-closures")
        if result["success"]:
            existing_closures = result["data"]
            print(f"   Existing closures before test: {len(existing_closures)}")
            self.log_result("daily_closures", "Get existing closures", True)
        else:
            self.log_result("daily_closures", "Get existing closures", False, f"Status: {result['status_code']}")
            existing_closures = []
        
        # Test 1: Create a new daily closure
        test_closure = {
            "date": datetime.utcnow().isoformat(),
            "total_sales": 150.75,
            "cash_sales": 80.25,
            "card_sales": 70.50,
            "mixed_sales": 0.0,
            "total_orders": 12,
            "zone_breakdown": {
                "terraza_exterior": {"sales": 75.25, "orders": 6},
                "salon_interior": {"sales": 50.50, "orders": 4},
                "terraza_interior": {"sales": 25.00, "orders": 2}
            },
            "closed_by": "test_user"
        }
        
        result = self.make_request("POST", "/daily-closures", test_closure)
        if not result["success"]:
            self.log_result("daily_closures", "Create closure", False, f"Status: {result['status_code']}")
            return
        
        created_closure = result["data"]
        self.log_result("daily_closures", "Create closure", True)
        
        # Test 2: Verify closure was created with correct data
        if 'id' in created_closure or '_id' in created_closure:
            self.log_result("daily_closures", "ID generation", True)
        else:
            self.log_result("daily_closures", "ID generation", False, "No ID in response")
        
        # Test 3: Create an old closure to test auto-delete
        old_date = datetime.utcnow() - timedelta(days=8)  # 8 days ago
        old_closure = {
            "date": old_date.isoformat(),
            "total_sales": 100.0,
            "cash_sales": 50.0,
            "card_sales": 50.0,
            "mixed_sales": 0.0,
            "total_orders": 8,
            "zone_breakdown": {
                "terraza_exterior": {"sales": 50.0, "orders": 4},
                "salon_interior": {"sales": 30.0, "orders": 2},
                "terraza_interior": {"sales": 20.0, "orders": 2}
            },
            "closed_by": "test_old_user"
        }
        
        # Create old closure first
        old_result = self.make_request("POST", "/daily-closures", old_closure)
        if old_result["success"]:
            print("   Created old closure for auto-delete test")
            
            # Now create a new closure to trigger auto-delete
            new_closure = {
                "date": datetime.utcnow().isoformat(),
                "total_sales": 200.0,
                "cash_sales": 100.0,
                "card_sales": 100.0,
                "mixed_sales": 0.0,
                "total_orders": 15,
                "zone_breakdown": {
                    "terraza_exterior": {"sales": 100.0, "orders": 8},
                    "salon_interior": {"sales": 60.0, "orders": 4},
                    "terraza_interior": {"sales": 40.0, "orders": 3}
                },
                "closed_by": "test_new_user"
            }
            
            trigger_result = self.make_request("POST", "/daily-closures", new_closure)
            if trigger_result["success"]:
                self.log_result("daily_closures", "Auto-delete trigger", True)
                self.created_closures.append(trigger_result["data"].get("_id"))
            else:
                self.log_result("daily_closures", "Auto-delete trigger", False, f"Status: {trigger_result['status_code']}")
        else:
            self.log_result("daily_closures", "Create old closure for test", False, f"Status: {old_result['status_code']}")
        
        print(f"   Daily Closure Creation Response: {json.dumps(created_closure, indent=2)}")

    def cleanup_test_data(self):
        """Clean up any test data created during testing"""
        print("\n=== Cleaning up test data ===")
        
        # Delete created orders
        for order_id in self.created_orders[:]:
            result = self.make_request("DELETE", f"/orders/{order_id}")
            if result["success"]:
                self.created_orders.remove(order_id)
                print(f"   Deleted order {order_id}")
        
        # Note: We don't delete closures as they are part of the business logic test

    def run_all_tests(self):
        """Run all backend tests for the 3 specific endpoints"""
        print(f"🚀 Starting Backend API Tests for El Rincón del Laurel")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🎯 Testing NEW/UPDATED endpoints: daily-stats, weekly-stats, daily-closures")
        
        try:
            # Create test data if needed
            self.create_test_order_if_needed()
            
            # Test the 3 specific endpoints requested
            self.test_daily_stats_with_zones()
            self.test_weekly_stats()
            self.test_daily_closures_auto_delete()
            
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