import os
import datetime
from pymongo import MongoClient

# Use local MongoDB
MONGO_URI = 'mongodb+srv://cybercrimecop54_db_user:HsDluodpnXz2HVkH@cluster0.dxraidx.mongodb.net/?appName=Cluster0'
DB_NAME = 'etada_portal'


def get_db():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    return db

def init_db():
    db = get_db()
    
    # We can add initial users here if the collection is empty
    if db.users.count_documents({}) == 0:
        import bcrypt
        
        # Add demo users
        demo_users = [
            {
                'userid': '12345678',
                'password_hash': bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
                'fullname': 'Inspector Rajesh Singh',
                'rank': 'Inspector (L&O)',
                'posting': 'Lucknow Police Commissionerate',
                'mobile': '9876543210',
                'email': 'rajesh.singh@uppolice.gov.in',
                'role': 'Employee',
                'bank_name': 'SBI',
                'bank_acct': '00000034567',
                'bank_ifsc': 'SBIN0001234'
            },
            {
                'userid': '22222222',
                'password_hash': bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
                'fullname': 'CO Amit Kumar',
                'rank': 'Circle Officer (CO)',
                'posting': 'Kanpur Outer',
                'mobile': '9988776655',
                'email': 'amit.kumar@uppolice.gov.in',
                'role': 'SO',
                'bank_name': 'HDFC',
                'bank_acct': '00000022222',
                'bank_ifsc': 'HDFC0001111'
            },
            {
                'userid': '33333333',
                'password_hash': bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
                'fullname': 'Sr AO Sushil Gupta',
                'rank': 'Senior Accounts Officer',
                'posting': 'UP Police HQ',
                'mobile': '8877665544',
                'email': 'sushil.gupta@uppolice.gov.in',
                'role': 'Admin',
                'bank_name': 'BOB',
                'bank_acct': '00000033333',
                'bank_ifsc': 'BARB0HQ'
            }
        ]
        
        db.users.insert_many(demo_users)
        print("Initialized MongoDB with demo users.")
