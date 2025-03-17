from flask import Blueprint, request, jsonify, session, redirect, url_for
from functools import wraps
import requests
import tempfile
import os
import json
import logging
import shutil
import sys
from groq import Groq
from openai import OpenAI
from models import db, Lesson, Settings
from urllib.parse import quote

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

@faq_ai.route('/api/faq-ai/generate', methods=['POST'])
@admin_required
def generate_faq():
    """Generate FAQ using AI based on video URL"""
    data = request.json
    lesson_id = data.get('lesson_id')
    model_id = data.get('model_id')
    provider = data.get('provider', 'groq')  # Default to GROQ for backward compatibility
    
    logger.info(f"Starting FAQ generation for lesson ID: {lesson_id} with model: {model_id} using {provider}")
    
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
    
    try:
        # Step 1: Get audio URL from the video
        encoded_url = quote(lesson.video_url)
        audio_api_url = f'https://youtube-mp310.p.rapidapi.com/download/mp3?url={encoded_url}'
        
        headers = {
            'x-rapidapi-host': 'youtube-mp310.p.rapidapi.com',
            'x-rapidapi-key': 'a0ff894664msh0f07edf8b97f736p1ef76ajsn3da6f4b57076'
        }
        
        logger.info(f"Requesting audio URL for video: {lesson.video_url}")
        # Make request to get audio URL
        response = requests.get(audio_api_url, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Error getting audio URL. Status code: {response.status_code}, Response: {response.text}")
            return jsonify({
                'success': False, 
                'message': f'Erro ao obter áudio do vídeo: {response.status_code}'
            })
        
        audio_data = response.json()
        download_url = audio_data.get('downloadUrl')
        
        if not download_url:
            logger.error("No download URL found in audio data response")
            return jsonify({
                'success': False, 
                'message': 'Não foi possível obter o URL de download do áudio'
            })
        
        # Step 2: Download audio file
        logger.info(f"Downloading audio from URL: {download_url}")
        audio_response = requests.get(download_url, stream=True)
        
        if audio_response.status_code != 200:
            logger.error(f"Error downloading audio. Status code: {audio_response.status_code}")
            return jsonify({
                'success': False, 
                'message': f'Erro ao baixar arquivo de áudio: {audio_response.status_code}'
            })
        
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
        
        # Write audio content to file
        try:
            # Write audio content to file using streaming
            with open(audio_file_path, 'wb') as f:
                for chunk in audio_response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
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
                logger.info(f"Using GROQ model: {model_id}")
                chat_completion = groq_client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {
                            "role": "user",
                            "content": f"Esta é a transcrição de uma aula intitulada '{lesson.title}'. Por favor, crie um FAQ com base nesta transcrição:\n\n{transcription.text}"
                        }
                    ],
                    model=model_id,
                    temperature=0.3,
                    max_tokens=2048,
                    top_p=1,
                )
            else:  # OpenAI
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
                            "content": f"Esta é a transcrição de uma aula intitulada '{lesson.title}'. Por favor, crie um FAQ com base nesta transcrição:\n\n{transcription.text}"
                        }
                    ],
                    temperature=0.3,
                    max_tokens=2048,
                    top_p=1
                )
            
            logger.info(f"Successfully generated FAQ using {provider}")
            
        except Exception as e:
            logger.exception(f"Error generating FAQ: {str(e)}")
            # Clean up audio file
            try:
                os.unlink(audio_file_path)
                logger.info(f"Temporary audio file {audio_file_path} deleted after error")
            except:
                pass
                
            return jsonify({
                'success': False,
                'message': f'Erro ao gerar FAQ com a IA: {str(e)}'
            })
        
        # Clean up temp file
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
            
    except Exception as e:
        logger.exception(f"Error in FAQ generation process: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro ao gerar FAQ: {str(e)}'
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