import os
from urllib.parse import urlparse
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, PyMongoError

DB_NAME = os.environ.get('DB_NAME', 'etada_portal')
_client = None


def get_mongo_uri():
    mongo_uri = os.environ.get('MONGO_URI', '').strip()
    if mongo_uri:
        return mongo_uri

    if os.environ.get('RENDER'):
        raise ConfigurationError('MONGO_URI is not configured. Add your MongoDB Atlas connection string in Render environment variables.')

    return 'mongodb://localhost:27017/'


def get_mongo_config_status():
    mongo_uri = os.environ.get('MONGO_URI', '').strip()
    if not mongo_uri:
        return {
            'configured': False,
            'message': 'MONGO_URI is missing in Render environment variables.'
        }

    parsed = urlparse(mongo_uri)
    if parsed.scheme not in ('mongodb', 'mongodb+srv'):
        return {
            'configured': False,
            'message': 'MONGO_URI must start with mongodb:// or mongodb+srv://.'
        }

    return {
        'configured': True,
        'scheme': parsed.scheme,
        'host': parsed.hostname or 'unknown',
        'database': DB_NAME
    }


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(get_mongo_uri(), serverSelectionTimeoutMS=5000)
    return _client[DB_NAME]

def init_db():
    try:
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
    except PyMongoError as exc:
        print(f"MongoDB initialization skipped: {exc}")
