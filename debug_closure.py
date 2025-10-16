#!/usr/bin/env python3
"""
Debug script to test the daily closure MongoDB update
"""

import requests
import json
from datetime import datetime

BACKEND_URL = "https://resto-manager-100.preview.emergentagent.com/api"

def debug_closure_issue():
    print("🔍 DEBUGGING DAILY CLOSURE ISSUE")
    print("=" * 50)
    
    # 1. Check current orders
    print("\n1. Checking current orders...")
    response = requests.get(f"{BACKEND_URL}/orders")
    orders = response.json()
    
    delivered_today = []
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    for order in orders:
        if order.get('status') == 'entregado':
            created_at = datetime.fromisoformat(order['created_at'].replace('Z', '+00:00'))
            if created_at >= today:
                delivered_today.append(order)
    
    print(f"   Delivered orders today: {len(delivered_today)}")
    if delivered_today:
        print(f"   Sample order ID: {delivered_today[0]['_id']}")
        print(f"   Sample created_at: {delivered_today[0]['created_at']}")
        print(f"   Sample closed_date: {delivered_today[0].get('closed_date', 'MISSING')}")
    
    # 2. Check current daily stats
    print("\n2. Checking daily stats...")
    response = requests.get(f"{BACKEND_URL}/daily-stats")
    stats = response.json()
    print(f"   Total sales: {stats['total_sales']}€")
    print(f"   Total orders: {stats['total_orders']}")
    
    # 3. Check existing closures
    print("\n3. Checking existing closures...")
    response = requests.get(f"{BACKEND_URL}/daily-closures")
    closures = response.json()
    
    today_closures = []
    for closure in closures:
        closure_date = datetime.fromisoformat(closure['date'].replace('Z', '+00:00'))
        if closure_date >= today:
            today_closures.append(closure)
    
    print(f"   Closures today: {len(today_closures)}")
    if today_closures:
        print(f"   Latest closure ID: {today_closures[0]['_id']}")
        print(f"   Latest closure sales: {today_closures[0]['total_sales']}€")
    
    # 4. Analysis
    print("\n4. ANALYSIS:")
    if len(today_closures) > 0 and stats['total_orders'] > 0:
        print("   ❌ BUG CONFIRMED: Closures exist but orders not marked as closed")
        print("   📋 ISSUE: MongoDB update_many query is not working")
        print("   🔧 POSSIBLE CAUSES:")
        print("      - Date format mismatch in MongoDB query")
        print("      - Field name mismatch (closed_date vs closedDate)")
        print("      - MongoDB connection issue")
        print("      - Query filter not matching any documents")
    elif len(today_closures) == 0:
        print("   ✅ No closures today - ready for testing")
    else:
        print("   ✅ Closures working correctly")

if __name__ == "__main__":
    debug_closure_issue()