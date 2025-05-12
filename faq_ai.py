from flask import Blueprint, request, jsonify, session, redirect, url_for, current_app, abort
from functools import wraps
import requests
import tempfile
import os
import json
import logging
import shutil
import sys
import re
from groq import Groq
from openai import OpenAI
from models import db, Lesson, Settings, LessonTranscript, Module, Course, FAQ
from urllib.parse import quote, urlparse, parse_qs

# Set up logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("faq_ai")

faq_ai = Blueprint('faq_ai', __name__)

# Admin decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_type' not in session or session['user_type'] != 'admin':
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@faq_ai.route('/api/faq-ai/models', methods=['GET'])
@admin_required
def get_ai_models():
    """Get available AI models for FAQ generation"""
    provider = request.args.get('provider', 'groq')
    logger.info(f"Getting available {provider} AI models")
    
    if provider == 'groq':
        models = [
            {"id": "deepseek-r1-distill-llama-70b", "name": "DeepSeek R1 com 70b", "description": "Recomendado - Alta capacidade de análise e síntese"},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 com 70b", "description": "Recomendado - Modelo versátil com forte raciocínio"},
            {"id": "llama-3.2-90b-vision-preview", "name": "Llama 3.2 com 90b", "description": "Modelo de grande capacidade com suporte a visão"},
            {"id": "deepseek-r1-distill-qwen-32b", "name": "DeepSeek R1 com 32b", "description": "Modelo compacto com bom equilíbrio de velocidade e qualidade"},
            {"id": "llama-3.2-11b-vision-preview", "name": "Llama 3.2 com 11b", "description": "Modelo rápido com suporte a visão"},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 com 8b", "description": "Modelo mais leve e rápido para respostas imediatas"}
        ]
    else:  # OpenAI
        models = [
            {"id": "gpt-4o", "name": "GPT-4O", "description": "Recomendado - Modelo mais avançado do ChatGPT"},
            {"id": "gpt-4o-mini", "name": "GPT-4O Mini", "description": "Versão mais rápida do GPT-4O"},
            {"id": "gpt-o1", "name": "GPT-O1", "description": "Modelo com bom equilíbrio entre velocidade e qualidade"},
            {"id": "gpt-o1-mini", "name": "GPT-O1 Mini", "description": "Modelo compacto e rápido"},
            {"id": "gpt-o3-mini", "name": "GPT-O3 Mini", "description": "Modelo mais leve e rápido"}
        ]
    
    return jsonify({'models': models})

@faq_ai.route('/api/faq-ai/check-api-key', methods=['GET'])
@admin_required
def check_api_key():
    """Check if AI API keys are configured"""
    logger.info("Checking if AI API keys are configured")
    settings = Settings.query.first()
    
    if not settings:
        logger.warning("No settings found")
        return jsonify({
            'success': False, 
            'message': 'Nenhuma configuração encontrada'
        })
    
    configured_providers = []
    
    if getattr(settings, 'groq_api', None):
        configured_providers.append('groq')
        
    if getattr(settings, 'openai_api', None):
        configured_providers.append('openai')
    
    if not configured_providers:
        logger.warning("No AI providers configured")
        return jsonify({
            'success': False, 
            'message': 'Nenhum provedor de IA configurado. Por favor, configure pelo menos uma API key.'
        })
    
    logger.info(f"Found configured providers: {configured_providers}")
    return jsonify({
        'success': True,
        'providers': configured_providers
    })

@faq_ai.route('/api/faq-ai/save-api-key', methods=['POST'])
@admin_required
def save_api_key():
    """Save AI provider API key"""
    logger.info("Saving new AI provider API key")
    data = request.json
    api_key = data.get('api_key')
    provider = data.get('provider', 'groq')  # Default to GROQ for backward compatibility
    
    if not api_key:
        logger.warning("API key not provided")
        return jsonify({
            'success': False, 
            'message': 'API key não fornecida'
        }), 400
    
    settings = Settings.query.first()
    if not settings:
        logger.info("Creating new settings record")
        settings = Settings()
        db.session.add(settings)
    
    if provider == 'groq':
        settings.groq_api = api_key
        settings.groq_api_enabled = True
    else:  # OpenAI
        settings.openai_api = api_key
        settings.openai_api_enabled = True
    
    db.session.commit()
    logger.info(f"{provider.upper()} API key saved successfully")
    
    return jsonify({
        'success': True,
        'message': f'API key da {provider.upper()} salva com sucesso'
    })

@faq_ai.route('/api/faq-ai/get-video-url', methods=['GET'])
@admin_required
def get_video_url():
    """Get video URL for a specific lesson"""
    lesson_id = request.args.get('lesson_id')
    logger.info(f"Getting video URL for lesson ID: {lesson_id}")
    
    if not lesson_id:
        logger.warning("Lesson ID not provided")
        return jsonify({'success': False, 'message': 'ID da aula não fornecido'})
    
    lesson = Lesson.query.get(lesson_id)
    
    if not lesson:
        logger.warning(f"Lesson with ID {lesson_id} not found")
        return jsonify({'success': False, 'message': 'Aula não encontrada'})
    
    if not lesson.video_url:
        logger.warning(f"Lesson with ID {lesson_id} has no video URL")
        return jsonify({'success': False, 'message': 'Esta aula não tem vídeo associado'})
    
    # Return video URL and type
    logger.info(f"Video URL found for lesson {lesson_id}, type: {lesson.video_type}")
    return jsonify({
        'success': True,
        'video_url': lesson.video_url,
        'video_type': lesson.video_type
    })

def extract_youtube_id(video_url):
    """Extract YouTube video ID from different URL formats"""
    logger.info(f"Extracting YouTube ID from URL: {video_url}")
    
    # Format: https://youtu.be/XXXXXXXXXXX or https://youtube.com/shorts/XXXXXXXXXXX
    short_link_pattern = r'(?:youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]+)'
    match = re.search(short_link_pattern, video_url)
    if match:
        youtube_id = match.group(1)
        logger.info(f"Extracted YouTube ID from short link: {youtube_id}")
        return youtube_id
    
    # Format: https://www.youtube.com/watch?v=XXXXXXXXXXX
    parsed_url = urlparse(video_url)
    if parsed_url.netloc in ('www.youtube.com', 'youtube.com'):
        query_params = parse_qs(parsed_url.query)
        if 'v' in query_params:
            youtube_id = query_params['v'][0]
            logger.info(f"Extracted YouTube ID from watch URL: {youtube_id}")
            return youtube_id
    
    # If no ID found, return the original URL (as it might be a direct mp3 link)
    logger.warning(f"Could not extract YouTube ID from URL: {video_url}")
    return video_url

def download_audio_api1(video_url):
    """First API attempt to download audio from YouTube video"""
    logger.info(f"API 1: Attempting to download audio from YouTube URL: {video_url}")
    
    try:
        encoded_url = quote(video_url)
        audio_api_url = f'https://youtube-mp310.p.rapidapi.com/download/mp3?url={encoded_url}'
        
        headers = {
            'x-rapidapi-host': 'youtube-mp310.p.rapidapi.com',
            'x-rapidapi-key': 'a0ff894664msh0f07edf8b97f736p1ef76ajsn3da6f4b57076'
        }
        
        # Make request to get audio URL
        logger.info(f"API 1: Requesting audio URL for video")
        response = requests.get(audio_api_url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"API 1: Error getting audio URL. Status code: {response.status_code}, Response: {response.text}")
            return None, None
        
        audio_data = response.json()
        download_url = audio_data.get('downloadUrl')
        
        if not download_url:
            logger.error("API 1: No download URL found in audio data response")
            return None, None
        
        # Download the audio content
        logger.info(f"API 1: Downloading audio from URL: {download_url}")
        audio_response = requests.get(download_url, stream=True, timeout=60)
        
        if audio_response.status_code != 200:
            logger.error(f"API 1: Error downloading audio. Status code: {audio_response.status_code}")
            return None, None
        
        logger.info("API 1: Audio download successful")
        return audio_response.content, None
        
    except Exception as e:
        logger.error(f"API 1: Exception during audio download: {str(e)}")
        return None, str(e)

def download_audio_api2(video_id):
    """Second API attempt to download audio from YouTube video ID"""
    logger.info(f"API 2: Attempting to download audio using YouTube ID: {video_id}")
    
    try:
        api_url = f'https://youtube-mp36.p.rapidapi.com/dl?id={video_id}'
        
        headers = {
            'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com',
            'x-rapidapi-key': 'a0ff894664msh0f07edf8b97f736p1ef76ajsn3da6f4b57076'
        }
        
        # Make request to get audio URL
        logger.info("API 2: Requesting download link")
        response = requests.get(api_url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"API 2: Error getting download link. Status code: {response.status_code}, Response: {response.text}")
            return None, None
        
        audio_data = response.json()
        
        # Check if the API call was successful
        if audio_data.get('status') != 'ok':
            logger.error(f"API 2: API returned error status: {audio_data.get('status')}, Message: {audio_data.get('msg')}")
            return None, None
        
        download_url = audio_data.get('link')
        
        if not download_url:
            logger.error("API 2: No download link found in response")
            return None, None
        
        # Download the audio content
        logger.info(f"API 2: Downloading audio from URL: {download_url}")
        audio_response = requests.get(download_url, stream=True, timeout=60)
        
        if audio_response.status_code != 200:
            logger.error(f"API 2: Error downloading audio. Status code: {audio_response.status_code}")
            return None, None
        
        logger.info("API 2: Audio download successful")
        return audio_response.content, None
        
    except Exception as e:
        logger.error(f"API 2: Exception during audio download: {str(e)}")
        return None, str(e)

def download_audio_api3(video_id):
    """Third API attempt to directly download audio from YouTube video ID"""
    logger.info(f"API 3: Attempting to directly download audio using YouTube ID: {video_id}")
    
    try:
        api_url = f'https://youtube-mp3-audio-video-downloader.p.rapidapi.com/download-mp3/{video_id}?quality=low'
        
        headers = {
            'x-rapidapi-host': 'youtube-mp3-audio-video-downloader.p.rapidapi.com',
            'x-rapidapi-key': 'a0ff894664msh0f07edf8b97f736p1ef76ajsn3da6f4b57076'
        }
        
        # Make direct download request
        logger.info("API 3: Requesting direct audio download")
        audio_response = requests.get(api_url, headers=headers, timeout=60)
        
        if audio_response.status_code != 200:
            logger.error(f"API 3: Error downloading audio. Status code: {audio_response.status_code}")
            return None, None
        
        # This API returns the binary audio data directly
        logger.info("API 3: Audio download successful")
        return audio_response.content, None
        
    except Exception as e:
        logger.error(f"API 3: Exception during audio download: {str(e)}")
        return None, str(e)

@faq_ai.route('/api/faq-ai/generate', methods=['POST'])
@admin_required
def generate_faq():
    """Generate FAQ using AI based on video URL"""
    data = request.json
    lesson_id = data.get('lesson_id')
    model_id = data.get('model_id')
    provider = data.get('provider', 'groq')  # Default to GROQ for backward compatibility
    generate_faq_flag = data.get('generate_faq', True)

    logger.info(f"Starting FAQ generation for lesson ID: {lesson_id} with model: {model_id} using {provider} (generate_faq={generate_faq_flag})")

    if not lesson_id:
        logger.warning("Lesson ID not provided")
        return jsonify({'success': False, 'message': 'ID da aula não fornecido'})

    # Get settings for API keys
    settings = Settings.query.first()

    if not settings:
        logger.warning("No settings found")
        return jsonify({
            'success': False, 
            'message': 'Configurações não encontradas'
        })

    if provider == 'groq' and not getattr(settings, 'groq_api', None):
        logger.warning("GROQ API key not found in settings")
        return jsonify({
            'success': False, 
            'message': 'API key da GROQ não encontrada'
        })
    elif provider == 'openai' and not getattr(settings, 'openai_api', None):
        logger.warning("OpenAI API key not found in settings")
        return jsonify({
            'success': False, 
            'message': 'API key da OpenAI não encontrada'
        })

    # Get lesson
    lesson = Lesson.query.get(lesson_id)

    if not lesson:
        logger.warning(f"Lesson with ID {lesson_id} not found")
        return jsonify({'success': False, 'message': 'Aula não encontrada'})

    if not lesson.video_url:
        logger.warning(f"Lesson with ID {lesson_id} has no video URL")
        return jsonify({'success': False, 'message': 'Esta aula não tem vídeo associado'})

    # Check if transcript already exists
    existing_transcript = LessonTranscript.query.filter_by(lesson_id=lesson_id).first()

    # Initialize variables needed for FAQ generation
    transcription_text = None
    groq_client = None
    openai_client = None
    audio_file_path = None

    # Check if transcript exists AND if the video_url matches the current lesson's video_url
    if existing_transcript and existing_transcript.transcript_text and existing_transcript.video_url == lesson.video_url:
        # Use existing transcript - video hasn't changed
        logger.info(f"Using existing transcript for lesson ID: {lesson_id} (video URL unchanged)")
        transcription_text = existing_transcript.transcript_text
        if provider == 'groq':
            groq_client = Groq(api_key=settings.groq_api)
        else:
            openai_client = OpenAI(api_key=settings.openai_api)
    else:
        # No transcript exists OR video URL has changed - need to download and transcribe audio
        if existing_transcript and existing_transcript.video_url != lesson.video_url:
            logger.info(f"Video URL changed for lesson ID: {lesson_id}, will retranscribe")
        else:
            logger.info(f"No existing transcript found for lesson ID: {lesson_id}, will download and transcribe")
        try:
            # Extract YouTube video ID if applicable
            youtube_id = extract_youtube_id(lesson.video_url)
            
            # Create directory in /app/temp if it doesn't exist (mapped in Docker volume)
            temp_dir = '/app/temp'
            if not os.path.exists(temp_dir):
                try:
                    os.makedirs(temp_dir)
                    logger.info(f"Created temp directory at {temp_dir}")
                except Exception as e:
                    logger.warning(f"Could not create temp directory: {str(e)}")
                    temp_dir = tempfile.gettempdir()  # Fall back to system temp directory
                    logger.info(f"Using system temp directory instead: {temp_dir}")
            
            # Create temp file for audio
            audio_file_path = os.path.join(temp_dir, f"audio_{lesson_id}.mp3")
            audio_content = None
            error_messages = []
            
            # Try API 1 (original method)
            audio_content, error = download_audio_api1(lesson.video_url)
            if error:
                error_messages.append(f"API 1 error: {error}")
                
            # If API 1 fails and we have a valid YouTube ID, try API 2
            if not audio_content and youtube_id != lesson.video_url:
                audio_content, error = download_audio_api2(youtube_id)
                if error:
                    error_messages.append(f"API 2 error: {error}")
                    
                # If API 2 also fails, try API 3
                if not audio_content:
                    audio_content, error = download_audio_api3(youtube_id)
                    if error:
                        error_messages.append(f"API 3 error: {error}")
            
            # If all APIs failed
            if not audio_content:
                logger.error(f"All audio download APIs failed: {'; '.join(error_messages)}")
                return jsonify({
                    'success': False,
                    'message': f'Erro ao baixar o áudio do vídeo. Tentativas falharam: {"; ".join(error_messages)}'
                })
                
            # Write audio content to file
            try:
                with open(audio_file_path, 'wb') as f:
                    if hasattr(audio_content, '__iter__') and not isinstance(audio_content, bytes):
                        # If it's an iterator (like response.iter_content())
                        for chunk in audio_content:
                            f.write(chunk)
                    else:
                        # If it's already in memory
                        f.write(audio_content)
                
                file_size = os.path.getsize(audio_file_path)
                logger.info(f"Audio saved to file: {audio_file_path}, Size: {file_size} bytes")
                
                if file_size == 0:
                    logger.error("Downloaded audio file is empty")
                    return jsonify({
                        'success': False,
                        'message': 'O arquivo de áudio baixado está vazio'
                    })
                    
            except Exception as e:
                logger.error(f"Error writing audio file: {str(e)}")
                return jsonify({
                    'success': False,
                    'message': f'Erro ao salvar o arquivo de áudio: {str(e)}'
                })
            
            # Step 3: Transcribe audio using selected provider
            try:
                if provider == 'groq':
                    # Initialize GROQ client
                    groq_client = Groq(api_key=settings.groq_api)
                    
                    # Create audio transcription
                    logger.info("Sending transcription request to GROQ")
                    with open(audio_file_path, 'rb') as audio_file:
                        audio_content = audio_file.read()
                        transcription = groq_client.audio.transcriptions.create(
                            file=(os.path.basename(audio_file_path), audio_content),
                            model="whisper-large-v3-turbo",
                            response_format="json"
                        )
                    logger.info("GROQ transcription completed successfully")
                    transcription_model = "whisper-large-v3-turbo"
                        
                else:  # OpenAI
                    # Initialize OpenAI client
                    openai_client = OpenAI(api_key=settings.openai_api)
                    
                    # Create audio transcription
                    logger.info("Sending transcription request to OpenAI")
                    with open(audio_file_path, 'rb') as audio_file:
                        transcription = openai_client.audio.transcriptions.create(
                            file=audio_file,
                            model="whisper-1"
                        )
                    logger.info("OpenAI transcription completed successfully")
                    transcription_model = "whisper-1"
                
                # Get the text from the transcription
                transcription_text = transcription.text
                
                # Save transcription to database
                try:
                    # Get module and course info
                    module = Module.query.get(lesson.module_id)
                    if not module:
                        logger.warning(f"Module with ID {lesson.module_id} not found")
                        course_id = 0
                        course_name = "Unknown Course"
                        module_name = "Unknown Module"
                    else:
                        course = Course.query.get(module.course_id)
                        course_id = module.course_id
                        course_name = course.name if course else "Unknown Course"
                        module_name = module.name
                        
                    # Check if transcript already exists again (edge case)
                    existing_transcript = LessonTranscript.query.filter_by(lesson_id=lesson_id).first()
                    
                    if existing_transcript:
                        logger.info(f"Updating existing transcript for lesson ID: {lesson_id}")
                        
                        # Update existing transcript
                        existing_transcript.lesson_title = lesson.title
                        existing_transcript.module_id = lesson.module_id
                        existing_transcript.module_name = module_name
                        existing_transcript.course_id = course_id
                        existing_transcript.course_name = course_name
                        existing_transcript.transcript_text = transcription_text
                        existing_transcript.transcription_provider = provider
                        existing_transcript.transcription_model = transcription_model
                        existing_transcript.language = 'pt-BR'  # Default language
                        existing_transcript.video_url = lesson.video_url  # Store the current video URL
                        
                        # Generate transcript metadata (vector and keywords)
                        try:
                            logger.info(f"Generating transcript metadata for lesson ID: {lesson_id}")
                            metadata = generate_transcript_metadata(
                                transcription_text, 
                                lesson.title, 
                                module_name, 
                                course_name, 
                                provider,
                                settings.groq_api if provider == 'groq' else settings.openai_api
                            )
                            existing_transcript.transcript_vector = metadata.get("transcript_vector", "")
                            existing_transcript.searchable_keywords = metadata.get("searchable_keywords", "")
                            logger.info(f"Transcript metadata generated successfully")
                        except Exception as e:
                            logger.warning(f"Error generating transcript metadata: {str(e)}")
                            # Continue even if metadata generation fails
                        
                        db.session.commit()
                        logger.info(f"Transcript updated successfully for lesson ID: {lesson_id}")
                    else:
                        logger.info(f"Creating new transcript for lesson ID: {lesson_id}")
                        
                        # Generate transcript metadata (vector and keywords)
                        transcript_vector = ""
                        searchable_keywords = ""
                        try:
                            logger.info(f"Generating transcript metadata for lesson ID: {lesson_id}")
                            metadata = generate_transcript_metadata(
                                transcription_text, 
                                lesson.title, 
                                module_name, 
                                course_name, 
                                provider,
                                settings.groq_api if provider == 'groq' else settings.openai_api
                            )
                            transcript_vector = metadata.get("transcript_vector", "")
                            searchable_keywords = metadata.get("searchable_keywords", "")
                            logger.info(f"Transcript metadata generated successfully")
                        except Exception as e:
                            logger.warning(f"Error generating transcript metadata: {str(e)}")
                            # Continue even if metadata generation fails
                        
                        # Create new transcript
                        new_transcript = LessonTranscript(
                            lesson_id=lesson_id,
                            lesson_title=lesson.title,
                            module_id=lesson.module_id,
                            module_name=module_name,
                            course_id=course_id,
                            course_name=course_name,
                            transcript_text=transcription_text,
                            transcription_provider=provider,
                            transcription_model=transcription_model,
                            language='pt-BR',  # Default language
                            transcript_vector=transcript_vector,
                            searchable_keywords=searchable_keywords,
                            video_url=lesson.video_url  # Store the current video URL
                        )
                        
                        db.session.add(new_transcript)
                        db.session.commit()
                        logger.info(f"New transcript saved successfully for lesson ID: {lesson_id}")
                        
                except Exception as e:
                    logger.exception(f"Error saving transcript to database: {str(e)}")
                    # Continue with FAQ generation even if saving transcript fails
                    # We don't want to block the FAQ generation process
                    
            except Exception as e:
                logger.exception(f"Error during transcription: {str(e)}")
                # Clean up audio file
                try:
                    os.unlink(audio_file_path)
                    logger.info(f"Temporary audio file {audio_file_path} deleted after error")
                except:
                    pass
                
                return jsonify({
                    'success': False,
                    'message': f'Erro ao transcrever áudio: {str(e)}'
                })
                
        except Exception as e:
            logger.exception(f"Error in audio processing: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Erro ao processar áudio: {str(e)}'
            })
    
    # Se for apenas para transcrever, não gerar FAQ
    if not generate_faq_flag:
        logger.info("generate_faq=False: returning only transcript import result")
        return jsonify({
            'success': True,
            'message': 'Transcrição importada com sucesso',
            'lesson_id': lesson_id
        })

    # Step 4: Generate FAQ from transcription
    logger.info("Generating FAQ from transcription")
    system_prompt = """Você é um especialista em criação de FAQs (Perguntas Frequentes) para aulas educacionais.
    
Sua tarefa é analisar a transcrição de uma aula e gerar um conjunto de perguntas frequentes com suas respectivas respostas.
    
Siga estas diretrizes:
1. Identifique os conceitos mais importantes e frequentemente discutidos na aula
2. Crie perguntas que abordem possíveis dúvidas que os alunos possam ter
3. Forneça respostas claras, concisas e informativas
4. As respostas devem ser baseadas exclusivamente no conteúdo da transcrição
5. Gere entre 5 e 10 perguntas, dependendo da complexidade e duração da aula
6. Apenas responda no formato JSON informado abaixo, sem nenhum outro texto adicional
    
Formate sua resposta como JSON no seguinte formato:
```json
{
  "faqs": [
    {
      "question": "Pergunta 1?",
      "answer": "Resposta detalhada para a pergunta 1."
    },
    {
      "question": "Pergunta 2?",
      "answer": "Resposta detalhada para a pergunta 2."
    }
  ]
}
```"""

    try:
        if provider == 'groq':
            # Create GROQ client if it doesn't exist yet
            if not groq_client:
                groq_client = Groq(api_key=settings.groq_api)
                
            logger.info(f"Using GROQ model: {model_id}")
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"Esta é a transcrição de uma aula intitulada '{lesson.title}'. Por favor, crie um FAQ com base nesta transcrição:\n\n{transcription_text}"
                    }
                ],
                model=model_id,
                temperature=0.3,
                max_tokens=2048,
                top_p=1,
            )
        else:  # OpenAI
            # Create OpenAI client if it doesn't exist yet
            if not openai_client:
                openai_client = OpenAI(api_key=settings.openai_api)
                
            logger.info(f"Using OpenAI model: {model_id}")
            chat_completion = openai_client.chat.completions.create(
                model=model_id,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"Esta é a transcrição de uma aula intitulada '{lesson.title}'. Por favor, crie um FAQ com base nesta transcrição:\n\n{transcription_text}"
                    }
                ],
                temperature=0.3,
                max_tokens=2048,
                top_p=1
            )
        
        logger.info(f"Successfully generated FAQ using {provider}")
        
    except Exception as e:
        logger.exception(f"Error generating FAQ: {str(e)}")
        # Clean up audio file if it exists
        if audio_file_path:
            try:
                os.unlink(audio_file_path)
                logger.info(f"Temporary audio file {audio_file_path} deleted after error")
            except:
                pass
            
        return jsonify({
            'success': False,
            'message': f'Erro ao gerar FAQ com a IA: {str(e)}'
        })
    
    # Clean up temp file if it exists
    if audio_file_path:
        try:
            os.unlink(audio_file_path)
            logger.info(f"Temporary audio file {audio_file_path} deleted successfully")
        except Exception as e:
            logger.warning(f"Could not delete temporary audio file: {str(e)}")
    
    # Parse the response from the AI
    try:
        ai_response = chat_completion.choices[0].message.content
        logger.info("Successfully received AI response")
        
        # Extract the JSON part if it's wrapped in ```json blocks
        if "```json" in ai_response:
            logger.info("Extracting JSON from code block with json annotation")
            ai_response = ai_response.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_response:
            logger.info("Extracting JSON from code block")
            ai_response = ai_response.split("```")[1].split("```")[0].strip()
        
        logger.info("Parsing JSON response")
        faqs = json.loads(ai_response)
        
        logger.info(f"Successfully generated {len(faqs['faqs'])} FAQ items")
        return jsonify({
            'success': True,
            'faqs': faqs['faqs'],
            'lesson_title': lesson.title
        })
        
    except Exception as e:
        logger.error(f"Error processing AI response: {str(e)}")
        logger.error(f"AI raw response: {chat_completion.choices[0].message.content}")
        return jsonify({
            'success': False,
            'message': f'Erro ao processar resposta da IA: {str(e)}',
            'ai_response': chat_completion.choices[0].message.content
        })

@faq_ai.route('/api/faq-ai/adjust', methods=['POST'])
@admin_required
def adjust_faq():
    """Adjust generated FAQ based on user prompt"""
    data = request.json
    prompt = data.get('prompt')
    faqs = data.get('faqs')
    model_id = data.get('model_id')
    provider = data.get('provider', 'groq')  # Default to GROQ for backward compatibility
    
    logger.info(f"Starting FAQ adjustment with prompt: {prompt} using {provider}")
    
    if not prompt or not faqs:
        logger.warning("Prompt or FAQs not provided")
        return jsonify({
            'success': False,
            'message': 'Prompt e FAQ são necessários para o ajuste'
        }), 400
    
    # Get settings for API keys
    settings = Settings.query.first()
    
    if not settings:
        logger.warning("No settings found")
        return jsonify({
            'success': False, 
            'message': 'Configurações não encontradas'
        })
    
    if provider == 'groq' and not getattr(settings, 'groq_api', None):
        logger.warning("GROQ API key not found in settings")
        return jsonify({
            'success': False, 
            'message': 'API key da GROQ não encontrada'
        })
    elif provider == 'openai' and not getattr(settings, 'openai_api', None):
        logger.warning("OpenAI API key not found in settings")
        return jsonify({
            'success': False, 
            'message': 'API key da OpenAI não encontrada'
        })
    
    try:
        # Initialize AI client based on provider
        if provider == 'groq':
            ai_client = Groq(api_key=settings.groq_api)
        else:  # OpenAI
            ai_client = OpenAI(api_key=settings.openai_api)
        
        # Prepare the FAQ content for the prompt
        faq_content = "\n\n".join([
            f"Pergunta: {faq['question']}\nResposta: {faq['answer']}"
            for faq in faqs
        ])
        
        system_prompt = """Você é um especialista em ajustar FAQs (Perguntas Frequentes) para aulas educacionais.
        
Sua tarefa é modificar o FAQ existente de acordo com as instruções do usuário.

Diretrizes:
1. Mantenha os principais conceitos e informações das respostas originais
2. Ajuste o estilo e tom conforme solicitado
3. Mantenha as respostas precisas e baseadas no conteúdo original
4. Não adicione informações que não estavam presentes no FAQ original
5. Retorne o FAQ completo, mesmo que apenas algumas partes precisem ser modificadas

Formate sua resposta como JSON no seguinte formato:
```json
{
  "faqs": [
    {
      "question": "Pergunta 1?",
      "answer": "Resposta detalhada para a pergunta 1."
    },
    {
      "question": "Pergunta 2?",
      "answer": "Resposta detalhada para a pergunta 2."
    }
  ]
}
```"""
        
        user_prompt = f"""Aqui está o FAQ atual:

{faq_content}

Instruções para ajuste: {prompt}

Por favor, ajuste o FAQ de acordo com as instruções mantendo as informações principais."""
        
        logger.info(f"Sending adjustment request to {provider}")
        
        if provider == 'groq':
            chat_completion = ai_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                model=model_id,
                temperature=0.3,
                max_tokens=2048,
                top_p=1,
            )
        else:  # OpenAI
            chat_completion = ai_client.chat.completions.create(
                model=model_id,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                temperature=0.3,
                max_tokens=2048,
                top_p=1
            )
        
        logger.info(f"Successfully received adjusted FAQ from {provider}")
        
        # Parse the response from the AI
        try:
            ai_response = chat_completion.choices[0].message.content
            
            # Extract the JSON part if it's wrapped in ```json blocks
            if "```json" in ai_response:
                logger.info("Extracting JSON from code block with json annotation")
                ai_response = ai_response.split("```json")[1].split("```")[0].strip()
            elif "```" in ai_response:
                logger.info("Extracting JSON from code block")
                ai_response = ai_response.split("```")[1].split("```")[0].strip()
            
            logger.info("Parsing JSON response")
            adjusted_faqs = json.loads(ai_response)
            
            logger.info(f"Successfully adjusted {len(adjusted_faqs['faqs'])} FAQ items")
            return jsonify({
                'success': True,
                'faqs': adjusted_faqs['faqs']
            })
            
        except Exception as e:
            logger.error(f"Error processing AI response: {str(e)}")
            logger.error(f"AI raw response: {chat_completion.choices[0].message.content}")
            return jsonify({
                'success': False,
                'message': f'Erro ao processar resposta da IA: {str(e)}',
                'ai_response': chat_completion.choices[0].message.content
            })
            
    except Exception as e:
        logger.exception(f"Error in FAQ adjustment process: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro ao ajustar FAQ: {str(e)}'
        })

# Função para gerar vetores de texto e palavras-chave para transcrições
def generate_transcript_metadata(transcript_text, lesson_title, module_name, course_name, ia_provider='groq', api_key=None):
    """
    Gera vetores de texto resumido e palavras-chave para a transcrição usando IA
    
    :param transcript_text: O texto completo da transcrição
    :param lesson_title: Título da aula
    :param module_name: Nome do módulo
    :param course_name: Nome do curso
    :param ia_provider: Provedor de IA a ser usado ('groq' ou 'openai')
    :param api_key: Chave de API para o provedor de IA
    :return: Um dicionário com transcript_vector e searchable_keywords
    """
    if not api_key:
        # Obter as configurações
        settings = Settings.query.first()
        if settings:
            if ia_provider == 'groq' and settings.groq_api_enabled:
                api_key = settings.groq_api
                ia_provider = 'groq'
            elif settings.openai_api_enabled:
                api_key = settings.openai_api
                ia_provider = 'openai'
            else:
                return {"transcript_vector": "", "searchable_keywords": ""}
    
    # Preparar o prompt para a IA
    prompt = f"""
    Com base na transcrição de aula a seguir, forneça:
    
    1. Um resumo conciso das informações principais (transcript_vector)
    2. Uma lista de palavras-chave relevantes (searchable_keywords), separadas por vírgulas
    
    Estas informações serão usadas para facilitar a busca por conteúdo relevante quando alunos fizerem perguntas.
    
    Detalhes da aula:
    - Título: {lesson_title}
    - Módulo: {module_name}
    - Curso: {course_name}
    
    Transcrição:
    {transcript_text[:3000]}...
    
    Por favor, forneça sua resposta no seguinte formato JSON exato:
    {{
        "transcript_vector": "Um resumo conciso capturando os conceitos principais...",
        "searchable_keywords": "keyword1, keyword2, keyword3, ..."
    }}
    """
    
    # Chamar a API apropriada
    try:
        if ia_provider == 'groq':
            return call_groq_for_metadata(prompt, api_key)
        else:  # openai
            return call_openai_for_metadata(prompt, api_key)
    except Exception as e:
        current_app.logger.error(f"Erro ao gerar metadados da transcrição: {str(e)}")
        return {"transcript_vector": "", "searchable_keywords": ""}


def call_groq_for_metadata(prompt, api_key):
    """Chama a API da GROQ para obter metadados da transcrição"""
    import groq
    
    client = groq.Client(api_key=api_key)
    model = "deepseek-r1-distill-llama-70b"  # Um bom modelo para análise de texto
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em análise de conteúdo educacional. Seu trabalho é extrair resumos e palavras-chave de transcrições de aulas."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # Baixa temperatura para respostas mais focadas
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return {
            "transcript_vector": result.get("transcript_vector", ""),
            "searchable_keywords": result.get("searchable_keywords", "")
        }
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar GROQ para metadados: {str(e)}")
        return {"transcript_vector": "", "searchable_keywords": ""}


def call_openai_for_metadata(prompt, api_key):
    """Chama a API da OpenAI para obter metadados da transcrição"""
    import openai
    
    client = openai.OpenAI(api_key=api_key)
    model = "gpt-4o"  # Modelo eficiente para análise de conteúdo
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em análise de conteúdo educacional. Seu trabalho é extrair resumos e palavras-chave de transcrições de aulas."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # Baixa temperatura para respostas mais focadas
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return {
            "transcript_vector": result.get("transcript_vector", ""),
            "searchable_keywords": result.get("searchable_keywords", "")
        }
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar OpenAI para metadados: {str(e)}")
        return {"transcript_vector": "", "searchable_keywords": ""}