import re

def format_description(description):
    # Identifica URLs e as transforma em links HTML
    url_pattern = r'https?://\S+'
    description = re.sub(url_pattern, lambda m: f'<a href="{m.group(0)}" target="_blank" class="text-blue-400 hover:underline">{m.group(0)}</a>', description)
    
    # Substitui quebras de linha por tags <br>
    description = description.replace('\n', '<br>')
    
    return description