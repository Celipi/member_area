from flask_sqlalchemy import SQLAlchemy
from uuid import uuid4
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

# Tabelas de associação
student_courses = db.Table('student_courses',
    db.Column('student_id', db.Integer, db.ForeignKey('student.id'), primary_key=True),
    db.Column('course_id', db.Integer, db.ForeignKey('course.id'), primary_key=True)
)

student_lessons = db.Table('student_lessons',
    db.Column('student_id', db.Integer, db.ForeignKey('student.id'), primary_key=True),
    db.Column('lesson_id', db.Integer, db.ForeignKey('lesson.id'), primary_key=True)
)

class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    platform_name = db.Column(db.String(120), nullable=False)
    is_installed = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    image = db.Column(db.String(255))
    module_format = db.Column(db.String(20), default='standard')  # 'standard' or 'netflix'
    theme = db.Column(db.String(20), default='light')  # 'light' or 'dark'
    modules = db.relationship('Module', backref='course', lazy=True, cascade="all, delete-orphan")
    showcases = db.relationship('Showcase', backref='course', lazy=True)

class Module(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    image = db.Column(db.String(255))
    order = db.Column(db.Integer)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    lessons = db.relationship('Lesson', backref='module', lazy=True, cascade="all, delete-orphan")

class Lesson(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    video_url = db.Column(db.Text, nullable=True)
    video_type = db.Column(db.String(50), default='youtube')  # Pode ser 'youtube' ou 'vturb'
    order = db.Column(db.Integer, nullable=False)
    has_button = db.Column(db.Boolean, default=False)
    button_text = db.Column(db.String(100))
    button_link = db.Column(db.String(500))
    button_delay = db.Column(db.Integer)
    module_id = db.Column(db.Integer, db.ForeignKey('module.id'), nullable=False)
    documents = db.relationship('Document', backref='lesson', lazy=True)
    
    def format_video_url(self):
        if self.video_type == 'youtube':
            # Formato atual para YouTube
            return self.video_url
        elif self.video_type == 'vturb':
            # Retorna o código VTurb como está
            return self.video_url
        return self.video_url

class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lesson.id'), nullable=False)

class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    courses = db.relationship('Course', secondary=student_courses, backref=db.backref('students', lazy='dynamic'))
    completed_lessons = db.relationship('Lesson', secondary=student_lessons, backref=db.backref('completed_by', lazy='dynamic'))

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # Support
    support_email = db.Column(db.String(120), nullable=True)
    sender_name = db.Column(db.String(255))
    sender_email = db.Column(db.String(255))
    
    # Brevo Integration
    brevo_enabled = db.Column(db.Boolean, default=False)
    brevo_api_key = db.Column(db.String(255), nullable=True)
    brevo_email_subject = db.Column(db.String(255), nullable=True)
    brevo_email_template = db.Column(db.Text, nullable=True)
    
    # Evolution API Integration
    evolution_enabled = db.Column(db.Boolean, default=False)
    evolution_url = db.Column(db.String(255), nullable=True)
    evolution_api_key = db.Column(db.String(255), nullable=True)
    evolution_message_template = db.Column(db.Text, nullable=True)
    evolution_version = db.Column(db.String(10), nullable=True)
    evolution_instance = db.Column(db.String(255), nullable=True)
    
    # GROQ AI Integration
    groq_api_enabled = db.Column(db.Boolean, default=False)
    groq_api = db.Column(db.String(255), nullable=True)

    # OpenAI Integration
    openai_api_enabled = db.Column(db.Boolean, default=False)
    openai_api = db.Column(db.String(255), nullable=True)
    
    # Chatbot Integration
    chatbot_enabled = db.Column(db.Boolean, default=False)
    chatbot_provider = db.Column(db.String(20), nullable=True)  # 'groq' or 'openai'
    chatbot_model = db.Column(db.String(50), nullable=True)  # modelo específico a ser usado
    chatbot_name = db.Column(db.String(100), nullable=True)  # nome do chatbot
    chatbot_avatar = db.Column(db.String(255), nullable=True)  # caminho para a imagem do avatar
    chatbot_welcome_message = db.Column(db.Text, nullable=True)  # mensagem de boas-vindas
    chatbot_use_internal_knowledge = db.Column(db.Boolean, default=False)  # permite que o chatbot use seu conhecimento interno

class Promotion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'image' or 'video'
    media_url = db.Column(db.String(255), nullable=False)  # Image filename or video URL
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    button_delay = db.Column(db.Integer, default=0)
    has_cta = db.Column(db.Boolean, default=False)
    cta_text = db.Column(db.String(120))
    cta_url = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    hide_video_controls = db.Column(db.Boolean, default=True)  # True para ocultar, False para mostrar controles

    @property
    def status(self):
        now = datetime.utcnow()
        if not self.is_active:
            return 'inactive'
        elif now < self.start_date:
            return 'upcoming'
        elif now > self.end_date:
            return 'expired'
        else:
            return 'active'

class Showcase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    image = db.Column(db.String(255))
    button_text = db.Column(db.String(50))
    button_link = db.Column(db.String(255))
    price = db.Column(db.String(20))
    has_video = db.Column(db.Boolean, default=False)
    video_url = db.Column(db.String(255))
    status = db.Column(db.String(20), default='active')
    priority = db.Column(db.Integer, default=5)
    button_delay = db.Column(db.Integer, default=0)  # novo campo para delay em segundos
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)  # Nova coluna para referenciar o curso
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ShowcaseAnalytics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    showcase_id = db.Column(db.Integer, db.ForeignKey('showcase.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)  # Nova coluna para a data (ex: 2025-01-30)
    views = db.Column(db.Integer, default=0)
    conversions = db.Column(db.Integer, default=0)
    __table_args__ = (db.UniqueConstraint('showcase_id', 'date', name='uix_showcase_date'),)
    showcase = db.relationship('Showcase', backref='analytics', lazy=True)

class FAQ(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lesson.id'), nullable=False)
    question = db.Column(db.String(255), nullable=False)
    answer = db.Column(db.Text, nullable=False)
    order = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class LessonTranscript(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lesson.id'), nullable=False, unique=True)
    
    # Cache hierarchical data for faster searches
    lesson_title = db.Column(db.String(120), nullable=False)
    module_id = db.Column(db.Integer, nullable=False)
    module_name = db.Column(db.String(120), nullable=False)
    course_id = db.Column(db.Integer, nullable=False)
    course_name = db.Column(db.String(120), nullable=False)
    video_url = db.Column((db.Text), nullable=True)  # Store the video URL for comparison
    
    # Transcript content
    transcript_text = db.Column(db.Text, nullable=False)
    
    # Metadata
    transcription_provider = db.Column(db.String(50), nullable=True)  # e.g., 'openai', 'groq', etc.
    transcription_model = db.Column(db.String(100), nullable=True)    # Model used for transcription
    language = db.Column(db.String(10), default='pt-BR')  # ISO language code
    duration_seconds = db.Column(db.Integer, nullable=True)  # Video/audio duration
    word_count = db.Column(db.Integer, nullable=True)
    
    # For search optimization
    transcript_vector = db.Column(db.Text, nullable=True)  # Optional: For vector embedding storage
    searchable_keywords = db.Column(db.Text, nullable=True)  # Optional: Extracted keywords
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<LessonTranscript: {self.lesson_title}>"

def init_db(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()