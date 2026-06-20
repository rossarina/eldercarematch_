from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    user_type = db.Column(db.String(20), nullable=False)  # 'elder' or 'caregiver' or 'admin'
    phone = db.Column(db.String(20), nullable=True)
    profile_image = db.Column(db.String(255), nullable=True)
    avatar_url = db.Column(db.String(512), nullable=True)   # Google profile picture
    google_id = db.Column(db.String(128), nullable=True, index=True)  # Google sub ID
    caregiver_id = db.Column(db.String(50), nullable=True, index=True)  # เชื่อมกับ Caregiver_Data sheet
    elder_id = db.Column(db.String(50), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    is_admin = db.Column(db.Boolean, nullable=False, default=False)
    approval_status = db.Column(db.String(20), nullable=False, default='pending')  # pending / approved / rejected

    # บัญชีรับเงิน (สำหรับ caregiver)
    payout_promptpay = db.Column(db.String(20), nullable=True)   # เบอร์/เลขบัตร PromptPay รับเงิน
    payout_bank_name = db.Column(db.String(50), nullable=True)   # ชื่อธนาคาร เช่น กสิกร / กรุงไทย
    payout_bank_account = db.Column(db.String(20), nullable=True) # เลขบัญชีธนาคาร
    payout_account_name = db.Column(db.String(100), nullable=True) # ชื่อบัญชี

    # Relationships
    hire_requests_as_elder = db.relationship('HireRequest', foreign_keys='HireRequest.elder_user_id', backref='elder', lazy='dynamic')
    hire_requests_as_caregiver = db.relationship('HireRequest', foreign_keys='HireRequest.caregiver_user_id', backref='caregiver_user', lazy='dynamic')

    def set_password(self, password):
        """Hash and set the password"""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt(rounds=12)
        ).decode('utf-8')

    def check_password(self, password):
        """Verify the password"""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def to_dict(self):
        """Convert user object to dictionary"""
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'user_type': self.user_type,
            'phone': self.phone,
            'profile_image': self.profile_image,
            'avatar_url': self.avatar_url,
            'google_id': self.google_id,
            'elder_id': self.elder_id,
            'caregiver_id': self.caregiver_id,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active,
            'is_admin': self.is_admin,
            'approval_status': self.approval_status,
            # บัญชีรับเงิน (caregiver)
            'payout_promptpay': self.payout_promptpay,
            'payout_bank_name': self.payout_bank_name,
            'payout_bank_account': self.payout_bank_account,
            'payout_account_name': self.payout_account_name,
        }

    def __repr__(self):
        return f'<User {self.email}>'


class HireRequest(db.Model):
    __tablename__ = 'hire_requests'

    id = db.Column(db.Integer, primary_key=True)
    elder_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    caregiver_sheet_id = db.Column(db.String(50), nullable=False)          # รหัสใน Google Sheet (CG001...)
    caregiver_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)  # account ของ caregiver
    message = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='pending')   # pending / accepted / rejected / completed
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with chat room (one-to-one)
    chat_room = db.relationship('ChatRoom', back_populates='hire_request', uselist=False)
    # Relationship with payment (one-to-one)
    payment = db.relationship('Payment', back_populates='hire_request', uselist=False)

    def to_dict(self):
        elder = User.query.get(self.elder_user_id)
        caregiver = User.query.get(self.caregiver_user_id) if self.caregiver_user_id else None
        chat_room_id = self.chat_room.id if self.chat_room else None
        chat_room_active = self.chat_room.is_active if self.chat_room else False
        payment_dict = self.payment.to_dict() if self.payment else None
        
        feedback_submitted = False
        if self.caregiver_sheet_id:
            feedback_submitted = Feedback.query.filter_by(
                elder_user_id=self.elder_user_id,
                caregiver_sheet_id=self.caregiver_sheet_id,
                hire_request_id=self.id
            ).first() is not None

        return {
            'id': self.id,
            'elder_user_id': self.elder_user_id,
            'elder_name': elder.full_name if elder else 'ไม่ระบุ',
            'caregiver_sheet_id': self.caregiver_sheet_id,
            'caregiver_user_id': self.caregiver_user_id,
            'caregiver_name': caregiver.full_name if caregiver else None,
            'message': self.message,
            'status': self.status,
            'chat_room_id': chat_room_id,
            'chat_room_active': chat_room_active,
            'payment': payment_dict,
            'feedback_submitted': feedback_submitted,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<HireRequest {self.id} elder={self.elder_user_id} cg={self.caregiver_sheet_id} status={self.status}>'


class ChatRoom(db.Model):
    __tablename__ = 'chat_rooms'

    id = db.Column(db.Integer, primary_key=True)
    hire_request_id = db.Column(db.Integer, db.ForeignKey('hire_requests.id'), nullable=False, unique=True)
    elder_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    caregiver_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)  # False = จบงานแล้ว แชทไม่ได้
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    hire_request = db.relationship('HireRequest', back_populates='chat_room')
    messages = db.relationship('ChatMessage', backref='room', lazy='dynamic', order_by='ChatMessage.created_at')
    elder = db.relationship('User', foreign_keys=[elder_user_id])
    caregiver = db.relationship('User', foreign_keys=[caregiver_user_id])

    def to_dict(self, viewer_id=None):
        msgs = list(self.messages.order_by(ChatMessage.created_at.desc()).limit(1))
        last_msg = msgs[0].message if msgs else None
        unread = 0
        if viewer_id:
            unread = self.messages.filter(
                ChatMessage.sender_id != viewer_id,
                ChatMessage.is_read == False
            ).count()
        return {
            'id': self.id,
            'hire_request_id': self.hire_request_id,
            'elder_user_id': self.elder_user_id,
            'caregiver_user_id': self.caregiver_user_id,
            'elder_name': self.elder.full_name if self.elder else 'ไม่ระบุ',
            'caregiver_name': self.caregiver.full_name if self.caregiver else 'ไม่ระบุ',
            'caregiver_sheet_id': self.hire_request.caregiver_sheet_id if self.hire_request else None,
            'status': self.hire_request.status if self.hire_request else None,
            'is_active': self.is_active,
            'last_message': last_msg,
            'unread_count': unread,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<ChatRoom {self.id} active={self.is_active}>'


class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_rooms.id'), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(512), nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    sender = db.relationship('User', foreign_keys=[sender_id])

    def to_dict(self):
        return {
            'id': self.id,
            'room_id': self.room_id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name if self.sender else 'ไม่ระบุ',
            'message': self.message,
            'image_url': self.image_url,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<ChatMessage {self.id} room={self.room_id}>'


class Feedback(db.Model):
    __tablename__ = 'feedbacks'

    id = db.Column(db.Integer, primary_key=True)
    elder_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    caregiver_sheet_id = db.Column(db.String(50), nullable=False)
    hire_request_id = db.Column(db.Integer, db.ForeignKey('hire_requests.id'), nullable=True)
    rating = db.Column(db.Integer, nullable=False)  # 1-5
    comment = db.Column(db.Text, nullable=True)
    service_quality = db.Column(db.Integer, nullable=True)  # 1-5 ด้านคุณภาพบริการ
    punctuality = db.Column(db.Integer, nullable=True)  # 1-5 ด้านตรงต่อเวลา
    communication = db.Column(db.Integer, nullable=True)  # 1-5 ด้านการสื่อสาร
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    elder = db.relationship('User', foreign_keys=[elder_user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'elder_user_id': self.elder_user_id,
            'elder_name': self.elder.full_name if self.elder else 'ไม่ระบุ',
            'caregiver_sheet_id': self.caregiver_sheet_id,
            'hire_request_id': self.hire_request_id,
            'rating': self.rating,
            'comment': self.comment,
            'service_quality': self.service_quality,
            'punctuality': self.punctuality,
            'communication': self.communication,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<Feedback {self.id} elder={self.elder_user_id} cg={self.caregiver_sheet_id} rating={self.rating}>'


class SystemNotification(db.Model):
    __tablename__ = 'system_notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False) # 'hire', 'payment', 'system'
    reference_id = db.Column(db.Integer, nullable=True) # e.g. HireRequest ID or Payment ID
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'message': self.message,
            'type': self.type,
            'reference_id': self.reference_id,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self):
        return f'<SystemNotification {self.id} user={self.user_id} read={self.is_read}>'


class Payment(db.Model):
    """Escrow Payment: เงินถูกพักไว้ที่ platform จนกว่างานจะเสร็จแล้วค่อย release ให้ caregiver"""
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    hire_request_id = db.Column(db.Integer, db.ForeignKey('hire_requests.id'), nullable=False, unique=True, index=True)
    elder_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    caregiver_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    caregiver_sheet_id = db.Column(db.String(50), nullable=False)

    amount = db.Column(db.Float, nullable=False)         # จำนวนเงินที่ Elder จ่าย (บาท)
    platform_fee_pct = db.Column(db.Float, nullable=False, default=10.0)  # % ค่าธรรมเนียมแพลตฟอร์ม
    platform_fee = db.Column(db.Float, nullable=False, default=0.0)       # บาทที่หัก
    caregiver_payout = db.Column(db.Float, nullable=False, default=0.0)   # บาทที่ caregiver ได้รับ
    # held = รอจบงาน | pending_confirm = รอยืนยันสลิป | released = โอนให้ caregiver แล้ว | refunded = คืนเงิน
    status = db.Column(db.String(20), nullable=False, default='held')
    payment_method = db.Column(db.String(50), nullable=True, default='promptpay')  # promptpay / platform / bank
    note = db.Column(db.Text, nullable=True)             # หมายเหตุ
    slip_url = db.Column(db.String(512), nullable=True)  # URL รูปสลิปการโอนเงิน

    held_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)      # วันที่ชำระเงิน
    released_at = db.Column(db.DateTime, nullable=True)  # วันที่ release เงิน
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hire_request = db.relationship('HireRequest', back_populates='payment')
    elder = db.relationship('User', foreign_keys=[elder_user_id])
    caregiver = db.relationship('User', foreign_keys=[caregiver_user_id])

    def to_dict(self):
        caregiver_user = self.caregiver
        return {
            'id': self.id,
            'hire_request_id': self.hire_request_id,
            'elder_user_id': self.elder_user_id,
            'elder_name': self.elder.full_name if self.elder else 'ไม่ระบุ',
            'caregiver_user_id': self.caregiver_user_id,
            'caregiver_name': caregiver_user.full_name if caregiver_user else None,
            'caregiver_sheet_id': self.caregiver_sheet_id,
            # บัญชีรับเงินของ caregiver
            'caregiver_payout_promptpay': caregiver_user.payout_promptpay if caregiver_user else None,
            'caregiver_payout_bank_name': caregiver_user.payout_bank_name if caregiver_user else None,
            'caregiver_payout_bank_account': caregiver_user.payout_bank_account if caregiver_user else None,
            'caregiver_payout_account_name': caregiver_user.payout_account_name if caregiver_user else None,
            # ยอดเงิน
            'amount': self.amount,
            'platform_fee_pct': self.platform_fee_pct,
            'platform_fee': self.platform_fee,
            'caregiver_payout': self.caregiver_payout,
            # สถานะ
            'status': self.status,
            'payment_method': self.payment_method,
            'note': self.note,
            'slip_url': self.slip_url,
            'held_at': self.held_at.isoformat() if self.held_at else None,
            'released_at': self.released_at.isoformat() if self.released_at else None,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<Payment {self.id} for HireRequest {self.hire_request_id}>'

class SupportChatRoom(db.Model):
    __tablename__ = 'support_chat_rooms'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])
    messages = db.relationship('SupportChatMessage', backref='room', lazy='dynamic', order_by='SupportChatMessage.created_at')

    def to_dict(self, viewer_role=None):
        msgs = list(self.messages.order_by(SupportChatMessage.created_at.desc()).limit(1))
        last_msg = msgs[0].message if msgs else None
        
        unread = 0
        if viewer_role == "admin":
            unread = self.messages.filter_by(is_admin_sender=False, is_read=False).count()
        elif viewer_role == "user":
            unread = self.messages.filter_by(is_admin_sender=True, is_read=False).count()

        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else 'ไม่ระบุ',
            'is_active': self.is_active,
            'last_message': last_msg,
            'unread_count': unread,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def __repr__(self):
        return f'<SupportChatRoom {self.id} user_id={self.user_id}>'

class SupportChatMessage(db.Model):
    __tablename__ = 'support_chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('support_chat_rooms.id'), nullable=False, index=True)
    is_admin_sender = db.Column(db.Boolean, nullable=False, default=False)
    message = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(512), nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'room_id': self.room_id,
            'is_admin_sender': self.is_admin_sender,
            'message': self.message,
            'image_url': self.image_url,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<SupportChatMessage {self.id} room={self.room_id}>'
