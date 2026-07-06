from flask import Flask, request, jsonify, send_from_directory
from flask_restful import Api, Resource
from flask_cors import CORS
import jwt
import bcrypt
import datetime
import os
import time
import random
import traceback
from functools import wraps
from werkzeug.utils import secure_filename
from werkzeug.exceptions import HTTPException
from bson import ObjectId
from pymongo.errors import PyMongoError
from db import get_db, get_mongo_config_status, init_db

# Resolve paths relative to this file's directory (BACKEND/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'FRONTEND')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
CORS(app)
api = Api(app)

SECRET_KEY = 'UP_POLICE_SECURE_TOKEN_SECRET_KEY'
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@app.errorhandler(PyMongoError)
def handle_database_error(error):
    print(f"Database error: {error}")
    return jsonify({
        'message': 'Database connection error. Please check MongoDB Atlas and MONGO_URI on Render.',
        'mongoConfig': get_mongo_config_status(),
        'checklist': [
            'Render Environment has MONGO_URI set',
            'MONGO_URI starts with mongodb+srv:// for MongoDB Atlas',
            'Atlas Database Access username and password are correct',
            'Atlas Network Access allows Render, usually 0.0.0.0/0',
            'Password special characters are URL encoded'
        ]
    }), 503

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    if isinstance(error, HTTPException):
        return jsonify({'message': error.description}), error.code

    print(f"Unexpected server error: {error}")
    traceback.print_exc()
    return jsonify({
        'message': 'Server error. Please check Render logs for details.'
    }), 500


def safe_text(value, default=''):
    if value is None:
        return default
    return str(value)


def safe_number(value, default=0):
    if value in (None, ''):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def serialize_claim(doc):
    """Convert a MongoDB claim document to a JSON-safe dict."""
    return {
        'id': safe_text(doc.get('id')),
        'userid': safe_text(doc.get('userid')),
        'submitDate': safe_text(doc.get('submit_date')),
        'journeyDate': safe_text(doc.get('journey_date')),
        'depStation': safe_text(doc.get('dep_station')),
        'arrStation': safe_text(doc.get('arr_station')),
        'travelMode': safe_text(doc.get('travel_mode')),
        'ticketNo': safe_text(doc.get('ticket_no')),
        'distance': safe_number(doc.get('distance')),
        'ticketFare': safe_number(doc.get('ticket_fare')),
        'purpose': safe_text(doc.get('purpose')),
        'daDays': safe_number(doc.get('da_days')),
        'daRate': safe_number(doc.get('da_rate')),
        'otherExp': safe_number(doc.get('other_exp')),
        'totalClaim': safe_number(doc.get('total_claim')),
        'status': safe_text(doc.get('status')),
        'attachment': safe_text(doc.get('attachment')),
        'soRemarks': safe_text(doc.get('so_remarks')),
        'accountsRemarks': safe_text(doc.get('accounts_remarks')),
        'timeline': {
            'step1': safe_text(doc.get('timeline_step1')),
            'step2': safe_text(doc.get('timeline_step2')),
            'step3': safe_text(doc.get('timeline_step3')),
            'step4': safe_text(doc.get('timeline_step4'))
        }
    }


def decode_auth_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return 'Signature expired. Please log in again.'
    except jwt.InvalidTokenError:
        return 'Invalid token. Please log in again.'


def verify_user_password(user, password):
    password_hash = user.get('password_hash', '')
    if password_hash:
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except ValueError:
            print(f"Invalid password hash stored for user {user.get('userid', '')}")
            return False

    legacy_password = user.get('password', '')
    return bool(legacy_password) and password == legacy_password


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        if not token:
            return {'message': 'Token is missing!'}, 401
        data = decode_auth_token(token)
        if isinstance(data, str):
            return {'message': data}, 401
        if not data.get('userid'):
            return {'message': 'Invalid token. Please log in again.'}, 401
        request.user_id = data['userid']
        request.user_role = data.get('role', 'Employee')
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# Auth Resources
# ---------------------------------------------------------------------------

class LoginResource(Resource):
    def post(self):
        try:
            data = request.get_json()
            if not data or 'userid' not in data or 'password' not in data:
                return {'message': 'Missing userid or password'}, 400

            userid = str(data['userid']).strip()
            password = data['password']

            db = get_db()
            user = db.users.find_one({'userid': userid})

            if not user:
                return {'message': 'Invalid User ID or Password'}, 401

            if not verify_user_password(user, password):
                return {'message': 'Invalid User ID or Password'}, 401

            if not user.get('password_hash') and user.get('password') == password:
                db.users.update_one(
                    {'_id': user['_id']},
                    {
                        '$set': {
                            'password_hash': bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                        },
                        '$unset': {'password': ''}
                    }
                )

            payload = {
                'userid': user.get('userid', userid),
                'role': user.get('role', 'Employee'),
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
            }
            token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')

            try:
                now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                db.audit_logs.insert_one({
                    'timestamp': now_str,
                    'userid': userid,
                    'action': 'LOGIN',
                    'details': f"User logged in from IP {request.remote_addr}"
                })
            except PyMongoError as audit_error:
                print(f"Login audit log skipped: {audit_error}")

            return {
                'token': token,
                'user': {
                    'userid': user.get('userid', userid),
                    'fullname': user.get('fullname', ''),
                    'rank': user.get('rank', ''),
                    'posting': user.get('posting', ''),
                    'role': user.get('role', 'Employee'),
                    'bankName': user.get('bank_name', ''),
                    'bankAcct': user.get('bank_acct', ''),
                    'bankIfsc': user.get('bank_ifsc', ''),
                    'mobile': user.get('mobile', ''),
                    'email': user.get('email', '')
                }
            }, 200
        except (PyMongoError, ValueError) as db_error:
            print(f"Login database error: {db_error}")
            return {
                'message': 'Database connection error. Please check MongoDB Atlas and MONGO_URI on Render.',
                'mongoConfig': get_mongo_config_status()
            }, 503


class RegisterResource(Resource):
    def post(self):
        try:
            data = request.get_json(silent=True) or {}
            required_fields = ['userid', 'password', 'fullname', 'rank', 'posting', 'mobile', 'email', 'role']
            if not all(str(data.get(k, '')).strip() for k in required_fields):
                return {'message': 'Please fill all required registration fields.'}, 400

            userid = str(data['userid']).strip()
            password = str(data['password'])
            fullname = str(data['fullname']).strip()
            rank = str(data['rank']).strip()
            posting = str(data['posting']).strip()
            mobile = str(data['mobile']).strip()
            email = str(data['email']).strip().lower()
            role = str(data['role']).strip()

            allowed_roles = {'Employee', 'SO', 'Admin'}
            if role not in allowed_roles:
                return {'message': 'Invalid portal role selected.'}, 400
            if len(userid) < 5:
                return {'message': 'User ID / PNO must be at least 5 digits.'}, 400
            if len(password) < 6:
                return {'message': 'Password must be at least 6 characters.'}, 400

            db = get_db()
            if db.users.find_one({'userid': userid}):
                return {'message': 'An officer account with this User ID (PNO) already exists. Please log in.'}, 409

            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            db.users.insert_one({
                'userid': userid,
                'password_hash': hashed,
                'fullname': fullname,
                'rank': rank,
                'posting': posting,
                'mobile': mobile,
                'email': email,
                'role': role,
                'bank_name': '',
                'bank_acct': '',
                'bank_ifsc': '',
                'created_at': datetime.datetime.utcnow()
            })

            try:
                now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                db.audit_logs.insert_one({
                    'timestamp': now_str,
                    'userid': userid,
                    'action': 'REGISTER',
                    'details': f"Account registered with role: {role}"
                })
            except PyMongoError as audit_error:
                print(f"Registration audit log skipped: {audit_error}")

            return {'message': 'Registration successful'}, 201
        except (PyMongoError, ValueError) as db_error:
            print(f"Registration database error: {db_error}")
            return {
                'message': 'Database connection error. Please check MongoDB Atlas and MONGO_URI on Render.',
                'mongoConfig': get_mongo_config_status()
            }, 503
        except ValueError as value_error:
            print(f"Registration validation error: {value_error}")
            return {'message': 'Registration details are invalid. Please check the form and try again.'}, 400

# ---------------------------------------------------------------------------
# Claim Resources
# ---------------------------------------------------------------------------

class ClaimSubmitResource(Resource):
    @token_required
    def post(self):
        if request.user_role != 'Employee':
            return {'message': 'Only employees can submit TA/DA claims'}, 403

        data = request.get_json()
        required_fields = ['journeyDate', 'depStation', 'arrStation', 'travelMode', 'ticketNo',
                            'distance', 'ticketFare', 'purpose', 'daDays', 'daRate', 'otherExp', 'totalClaim']
        if not data or not all(k in data for k in required_fields):
            return {'message': 'Missing required claim fields'}, 400

        claim_id = "TA-" + str(random.randint(10000, 99999))
        today = datetime.datetime.now()
        submission_date_str = f"{today.day} {today.strftime('%b')} {today.year}"

        db = get_db()
        db.claims.insert_one({
            'id': claim_id,
            'userid': request.user_id,
            'submit_date': submission_date_str,
            'journey_date': data['journeyDate'],
            'dep_station': data['depStation'],
            'arr_station': data['arrStation'],
            'travel_mode': data['travelMode'],
            'ticket_no': data['ticketNo'],
            'distance': data['distance'],
            'ticket_fare': data['ticketFare'],
            'purpose': data['purpose'],
            'da_days': data['daDays'],
            'da_rate': data['daRate'],
            'other_exp': data['otherExp'],
            'total_claim': data['totalClaim'],
            'status': 'pending_so',
            'attachment': data.get('attachment', ''),
            'so_remarks': '',
            'accounts_remarks': '',
            'timeline_step1': submission_date_str,
            'timeline_step2': 'Processing',
            'timeline_step3': None,
            'timeline_step4': None
        })

        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db.audit_logs.insert_one({
            'timestamp': now_str,
            'userid': request.user_id,
            'action': 'SUBMIT_CLAIM',
            'details': f"Submitted claim {claim_id} for \u20b9{data['totalClaim']}"
        })

        return {'message': 'Claim submitted successfully', 'claimId': claim_id}, 201


class ClaimUserResource(Resource):
    @token_required
    def get(self, pno):
        if request.user_role == 'Employee' and request.user_id != pno:
            return {'message': 'Unauthorized to view other officer claims'}, 403

        db = get_db()
        rows = list(db.claims.find({'userid': pno}, {'_id': 0}))
        claims = [serialize_claim(r) for r in rows]
        return claims, 200


class ClaimPendingResource(Resource):
    @token_required
    def get(self):
        if request.user_role not in ['SO', 'Admin']:
            return {'message': 'Only SO and Admin users can access the review queue'}, 403

        posting_filter = request.args.get('posting', '').strip()
        rank_filter = request.args.get('rank', '').strip()
        date_filter = request.args.get('date', '').strip()

        workflow_config = {
            'SO': {
                'target_status': 'pending_so',
                'review_stage': 'SO Verification'
            },
            'Admin': {
                'target_status': 'pending_accounts',
                'review_stage': 'Admin / Accounts Approval'
            }
        }
        role_workflow = workflow_config[request.user_role]
        target_status = role_workflow['target_status']

        db = get_db()
        claims_query = {'status': target_status}
        if date_filter:
            claims_query['journey_date'] = date_filter

        claim_docs = list(db.claims.find(claims_query, {'_id': 0}).sort('_id', -1))

        result = []
        for claim in claim_docs:
            claim_userid = claim.get('userid')
            if not claim_userid:
                continue

            user = db.users.find_one({'userid': claim_userid}, {'_id': 0})
            if not user:
                continue
            if posting_filter and posting_filter.lower() not in user.get('posting', '').lower():
                continue
            if rank_filter and rank_filter != user.get('rank', ''):
                continue
            d = serialize_claim(claim)
            d['officerName'] = user.get('fullname', '')
            d['officerRank'] = user.get('rank', '')
            d['officerPosting'] = user.get('posting', '')
            d['reviewStage'] = role_workflow['review_stage']
            result.append(d)

        return result, 200


class ClaimApproveResource(Resource):
    @token_required
    def put(self, claim_id):
        if request.user_role not in ['SO', 'Admin']:
            return {'message': 'Only SO and Admin users can approve or reject claims'}, 403

        data = request.get_json() or {}
        action = data.get('action')
        remarks = data.get('remarks', '').strip()

        if not action or action not in ['approve', 'reject']:
            return {'message': 'Invalid action'}, 400

        db = get_db()
        claim = db.claims.find_one({'id': claim_id})

        if not claim:
            return {'message': 'Claim not found'}, 404

        today = datetime.datetime.now()
        today_str = f"{today.day} {today.strftime('%b')} {today.year}"

        update_fields = {}
        log_action = ''
        log_details = ''

        if request.user_role == 'SO':
            if claim.get('status') != 'pending_so':
                return {'message': 'Claim is not in pending SO state'}, 400
            if action == 'approve':
                new_status = 'pending_accounts'
                update_fields = {
                    'status': new_status,
                    'so_remarks': remarks,
                    'timeline_step2': today_str,
                    'timeline_step3': 'Processing'
                }
                log_action = 'SO_APPROVE'
                log_details = f"SO approved claim {claim_id} and forwarded to Accounts. Remarks: {remarks}"
            else:
                new_status = 'rejected'
                update_fields = {
                    'status': new_status,
                    'so_remarks': remarks,
                    'timeline_step2': 'Rejected'
                }
                log_action = 'SO_REJECT'
                log_details = f"SO rejected claim {claim_id}. Remarks: {remarks}"

        elif request.user_role == 'Admin':
            if claim.get('status') != 'pending_accounts':
                return {'message': 'Claim is not in pending Accounts state'}, 400
            if action == 'approve':
                new_status = 'disbursed'
                update_fields = {
                    'status': new_status,
                    'accounts_remarks': remarks,
                    'timeline_step3': today_str,
                    'timeline_step4': today_str
                }
                log_action = 'ACCOUNTS_DISBURSE'
                log_details = f"Accounts approved and disbursed funds for claim {claim_id}. Remarks: {remarks}"
            else:
                new_status = 'rejected'
                update_fields = {
                    'status': new_status,
                    'accounts_remarks': remarks,
                    'timeline_step3': 'Rejected'
                }
                log_action = 'ACCOUNTS_REJECT'
                log_details = f"Accounts rejected claim {claim_id}. Remarks: {remarks}"

        db.claims.update_one({'id': claim_id}, {'$set': update_fields})

        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db.audit_logs.insert_one({
            'timestamp': now_str,
            'userid': request.user_id,
            'action': log_action,
            'details': log_details
        })

        return {'message': f"Claim {action}d successfully", 'status': new_status}, 200

# ---------------------------------------------------------------------------
# Upload Resource
# ---------------------------------------------------------------------------

class UploadResource(Resource):
    @token_required
    def post(self):
        if 'file' not in request.files:
            return {'message': 'No file part in request'}, 400

        file = request.files['file']
        if file.filename == '':
            return {'message': 'No selected file'}, 400

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ['.pdf', '.png', '.jpg', '.jpeg']:
            return {'message': 'Unsupported file type. Please upload PDF, PNG, or JPG.'}, 400

        filename = f"{int(time.time())}_{secure_filename(file.filename)}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        db_path = f"/uploads/{filename}"

        db = get_db()
        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db.audit_logs.insert_one({
            'timestamp': now_str,
            'userid': request.user_id,
            'action': 'UPLOAD_DOCUMENT',
            'details': f"Uploaded bill receipt: {filename}"
        })

        return {'filepath': db_path}, 200

# ---------------------------------------------------------------------------
# Audit Logs Resource
# ---------------------------------------------------------------------------

class AuditLogsResource(Resource):
    @token_required
    def get(self):
        if request.user_role == 'Employee':
            return {'message': 'Unauthorized to access audit logs'}, 403

        db = get_db()
        rows = list(db.audit_logs.find({}, {'_id': 0}).sort('_id', -1))
        logs = []
        for i, r in enumerate(rows):
            logs.append({
                'id': i + 1,
                'timestamp': r.get('timestamp', ''),
                'userid': r.get('userid', ''),
                'action': r.get('action', ''),
                'details': r.get('details', '')
            })
        return logs, 200

# ---------------------------------------------------------------------------
# Profile Resource
# ---------------------------------------------------------------------------

class ProfileResource(Resource):
    @token_required
    def get(self):
        db = get_db()
        user = db.users.find_one({'userid': request.user_id}, {'_id': 0})

        if not user:
            return {'message': 'User not found'}, 404

        return {
            'userid': user.get('userid', ''),
            'fullname': user.get('fullname', ''),
            'rank': user.get('rank', ''),
            'posting': user.get('posting', ''),
            'role': user.get('role', 'Employee'),
            'bankName': user.get('bank_name', ''),
            'bankAcct': user.get('bank_acct', ''),
            'bankIfsc': user.get('bank_ifsc', ''),
            'mobile': user.get('mobile', ''),
            'email': user.get('email', '')
        }, 200

    @token_required
    def put(self):
        data = request.get_json()
        required_fields = ['fullname', 'rank', 'posting', 'bankName', 'bankAcct', 'bankIfsc', 'mobile']
        if not data or not all(k in data for k in required_fields):
            return {'message': 'Missing required profile fields'}, 400

        db = get_db()
        db.users.update_one(
            {'userid': request.user_id},
            {'$set': {
                'fullname': data['fullname'].strip(),
                'rank': data['rank'].strip(),
                'posting': data['posting'].strip(),
                'bank_name': data['bankName'].strip(),
                'bank_acct': data['bankAcct'].strip(),
                'bank_ifsc': data['bankIfsc'].strip().upper(),
                'mobile': data['mobile'].strip()
            }}
        )

        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db.audit_logs.insert_one({
            'timestamp': now_str,
            'userid': request.user_id,
            'action': 'PROFILE_UPDATE',
            'details': "Updated contact or bank profile details"
        })

        return {'message': 'Profile updated successfully'}, 200

# ---------------------------------------------------------------------------
# Static File Serving
# ---------------------------------------------------------------------------

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/api/health')
def health_check():
    try:
        db = get_db()
        db.command('ping')
        return jsonify({
            'status': 'ok',
            'database': 'connected',
            'mongoConfig': get_mongo_config_status()
        }), 200
    except (PyMongoError, ValueError) as error:
        print(f"Health check database error: {error}")
        return jsonify({
            'status': 'error',
            'database': 'not connected',
            'message': 'Check MongoDB Atlas and MONGO_URI on Render',
            'mongoConfig': get_mongo_config_status()
        }), 503

@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ---------------------------------------------------------------------------
# API Routes Registration
# ---------------------------------------------------------------------------

api.add_resource(LoginResource, '/api/login')
api.add_resource(RegisterResource, '/api/register')
api.add_resource(ClaimSubmitResource, '/api/claim/submit')
api.add_resource(ClaimUserResource, '/api/claim/user/<string:pno>')
api.add_resource(ClaimPendingResource, '/api/claim/pending')
api.add_resource(ClaimApproveResource, '/api/claim/<string:claim_id>/approve')
api.add_resource(UploadResource, '/api/upload')
api.add_resource(AuditLogsResource, '/api/audit-logs')
api.add_resource(ProfileResource, '/api/profile')

# Gunicorn imports app:app in production, so initialize the database at import time.
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
