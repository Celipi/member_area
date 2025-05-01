// Inicializa os ícones do Lucide
lucide.createIcons();

// Função para obter o ID do curso da URL
function getCourseId() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

// Função para carregar os dados do curso
function loadCourseData() {
    const courseId = getCourseId();
    fetch(`/api/preview_course/${courseId}`)
        .then(response => response.json())
        .then(data => {
            populateCourseData(data);
            populateModules(data.modules);
            // Animar a barra de progresso após carregar os dados
            // Se os campos de progresso não existirem, evita erro
            if (data.completedLessons !== undefined && data.totalLessons !== undefined) {
                animateProgressBar(data.completedLessons, data.totalLessons);
            }
        })
        .catch(error => console.error('Erro ao carregar dados do curso:', error));
}

// Função para animar a barra de progresso
function animateProgressBar(completed, total) {
    const progressPercentage = (completed / total) * 100;
    const progressBar = document.getElementById('courseProgress');
    
    // Primeiro definimos a largura como 0 para garantir a animação
    progressBar.style.width = '0%';
    
    // Aguardar um momento para o DOM renderizar e depois animar
    setTimeout(() => {
        progressBar.style.width = `${progressPercentage}%`;
    }, 300);
}

// Função para preencher os dados do curso
function populateCourseData(courseData) {
    // Atualizar o título da página
    document.title = `${courseData.title} | Pré-visualização`;
    
    // Verificar se os dados de progresso existem e são válidos
    const hasValidProgressData = 
        courseData.completedLessons !== undefined && 
        courseData.totalLessons !== undefined &&
        !isNaN(courseData.completedLessons) && 
        !isNaN(courseData.totalLessons) &&
        courseData.totalLessons > 0;
    
    // Elemento que contém a barra de progresso
    const progressContainer = document.querySelector('.progress-container');
    
    if (hasValidProgressData) {
        // Configurar a barra de progresso quando os dados existem
        const progressPercentage = (courseData.completedLessons / courseData.totalLessons) * 100;
        document.getElementById('courseProgress').style.width = `${progressPercentage}%`;
        document.getElementById('courseCompletion').textContent = 
            `${courseData.completedLessons} de ${courseData.totalLessons} aulas concluídas (${progressPercentage.toFixed(1)}%)`;
        
        // Garantir que o container de progresso esteja visível
        if (progressContainer) {
            progressContainer.style.display = 'inline-flex';
        }
    } else {
        // Esconder o container de progresso quando os dados não existem ou são inválidos
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }
    
    // Configurar o cabeçalho do curso com imagem de capa
    const courseHeader = document.getElementById('courseHeader');
    
    // Detecta se é mobile
    const isMobile = window.innerWidth <= 768;
    let coverUrl = `/static/uploads/cover_${courseData.id}.jpg`;
    let mobileCoverUrl = `/static/uploads/cover_${courseData.id}_mobile.jpg`;
    
    function hideHeader() {
        courseHeader.style.display = 'none';
    }
    
    function showHeader() {
        courseHeader.style.display = '';
    }
    
    if (isMobile) {
        var imgMobile = new Image();
        imgMobile.onload = function() {
            showHeader();
            courseHeader.style.backgroundImage = `url(${mobileCoverUrl})`;
            courseHeader.style.backgroundSize = "cover";
            courseHeader.style.backgroundPosition = "center";
            courseHeader.style.minHeight = "620px";
        };
        imgMobile.onerror = function() {
            // Se não existir, tenta o desktop
            var img = new Image();
            img.onload = function() {
                showHeader();
                courseHeader.style.backgroundImage = `url(${coverUrl})`;
                courseHeader.style.backgroundSize = "cover";
                courseHeader.style.backgroundPosition = "center";
                courseHeader.style.paddingTop = "42%";
                courseHeader.style.minHeight = "initial";
            };
            img.onerror = function() {
                hideHeader();
            };
            img.src = coverUrl;
        };
        imgMobile.src = mobileCoverUrl;
    } else {
        var img = new Image();
        img.onload = function(){
            showHeader();
            courseHeader.style.backgroundImage = `url(${coverUrl})`;
            courseHeader.style.backgroundSize = "cover";
            courseHeader.style.backgroundPosition = "center";
            courseHeader.style.paddingTop = "42%";
            courseHeader.style.minHeight = "initial";
        };
        img.onerror = function(){
            hideHeader();
        };
        img.src = coverUrl;
    }
    
    // Atualizar nome da plataforma se disponível
    if (courseData.platform_name) {
        const platformName = courseData.platform_name;
        
        // Atualizar no footer
        const footerPlatformNameElement = document.getElementById('footerPlatformName');
        if (footerPlatformNameElement) {
            footerPlatformNameElement.textContent = platformName;
        }
        
        // Atualizar título da página
        document.title = `${courseData.title} | ${platformName} (Pré-visualização)`;
    }
}

// Função para criar um card de módulo no novo estilo
function createModuleCard(module) {
    const courseId = getCourseId();
    const moduleUrl = `/preview_course/${courseId}/module/${module.id}/lesson/1`;
    
    return `
        <div class="module-card cursor-pointer" onclick="window.location.href='${moduleUrl}'">
            <div class="w-full h-full" style="aspect-ratio: auto; position: relative;">
                <img 
                    src="/static/uploads/${module.image}" 
                    alt="${module.title}" 
                    class="module-image"
                    onload="adjustModuleImageSize(this)"
                >
            </div>
        </div>
    `;
}

// Função para ajustar o tamanho da imagem do módulo com base em suas proporções naturais
function adjustModuleImageSize(imgElement) {
    // Verifica a proporção natural da imagem
    const imgWidth = imgElement.naturalWidth;
    const imgHeight = imgElement.naturalHeight;
    const aspectRatio = imgWidth / imgHeight;
    
    // Ajusta o estilo com base na proporção
    const parentCard = imgElement.closest('.module-card');
    if (parentCard) {
        if (aspectRatio < 0.5) {
            // Imagem muito vertical (semelhante a 9:16 ou mais estreita)
            imgElement.style.objectFit = 'cover';
        } else if (aspectRatio > 1) {
            // Imagem mais horizontal que vertical
            imgElement.style.objectFit = 'contain';
            imgElement.style.backgroundColor = 'rgba(0,0,0,0.85)'; // Escurecido para melhor contraste
            parentCard.style.height = '380px'; // Altura fixa para imagens horizontais
        } else {
            // Imagens de proporções variadas
            imgElement.style.objectFit = 'cover';
        }
    }
}

// Função para preencher os módulos - modificada para garantir alinhamento correto
function populateModules(modules) {
    const modulesWrapper = document.getElementById('modulesWrapper');
    
    if (modules.length === 0) {
        modulesWrapper.innerHTML = `
            <div class="w-full flex flex-col items-center justify-center py-12">
                <i data-lucide="file-question" class="h-16 w-16 text-gray-300 mb-4"></i>
                <p class="text-gray-300 text-lg">Nenhum módulo disponível neste curso</p>
                <p class="text-gray-400 text-sm mt-2">Volte mais tarde para verificar atualizações</p>
            </div>
        `;
    } else {
        // Limpar completamente qualquer conteúdo atual
        modulesWrapper.innerHTML = '';
        
        // Adicionar os módulos um por um para garantir controle total
        modules.forEach((module, index) => {
            const moduleElement = document.createElement('div');
            moduleElement.className = 'module-card cursor-pointer';
            moduleElement.style.marginLeft = index === 0 ? '0' : ''; // Garantir que o primeiro não tenha margem
            moduleElement.onclick = function() {
                window.location.href = `/preview_course/${getCourseId()}/module/${module.id}/lesson/1`;
            };
            
            moduleElement.innerHTML = `
                <div class="w-full h-full" style="aspect-ratio: auto; position: relative;">
                    <img 
                        src="/static/uploads/${module.image}" 
                        alt="${module.title}" 
                        class="module-image"
                        onload="adjustModuleImageSize(this)"
                    >
                </div>
            `;
            
            modulesWrapper.appendChild(moduleElement);
        });
        
        // Inicializar os controles de navegação
        initNavigationControls();
        
        // Pré-carregar as imagens para detectar suas dimensões
        modules.forEach(module => {
            const imgUrl = `/static/uploads/${module.image}`;
            const img = new Image();
            img.src = imgUrl;
        });
    }
    
    lucide.createIcons(); // Reinicializa os ícones após adicionar novo conteúdo
}

// Função para inicializar os controles de navegação
function initNavigationControls() {
    const modulesWrapper = document.getElementById('modulesWrapper');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    
    // Verificar se é necessário mostrar os botões de navegação
    const checkScrollButtons = () => {
        // Verificar se existem módulos suficientes para necessitar de navegação
        if (modulesWrapper.scrollWidth > modulesWrapper.clientWidth) {
            // Mostrar botão anterior se houver conteúdo à esquerda
            if (modulesWrapper.scrollLeft > 20) {
                prevButton.classList.remove('hidden');
            } else {
                prevButton.classList.add('hidden');
            }
            
            // Mostrar botão próximo se houver conteúdo à direita
            const maxScrollLeft = modulesWrapper.scrollWidth - modulesWrapper.clientWidth;
            if (modulesWrapper.scrollLeft < maxScrollLeft - 20) { // tolerância maior
                nextButton.classList.remove('hidden');
            } else {
                nextButton.classList.add('hidden');
            }
        } else {
            // Não há módulos suficientes para rolagem, esconder ambos os botões
            prevButton.classList.add('hidden');
            nextButton.classList.add('hidden');
        }
    };
    
    // Verificar inicialmente após um breve atraso para garantir que tudo foi renderizado
    setTimeout(checkScrollButtons, 300);
    
    // Adicionar event listeners para botões com uma rolagem mais suave
    prevButton.addEventListener('click', () => {
        // Calcular a largura aproximada de 2-3 módulos para rolagem
        const scrollDistance = Math.min(modulesWrapper.clientWidth * 0.8, 800);
        modulesWrapper.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
    });
    
    nextButton.addEventListener('click', () => {
        // Calcular a largura aproximada de 2-3 módulos para rolagem
        const scrollDistance = Math.min(modulesWrapper.clientWidth * 0.8, 800);
        modulesWrapper.scrollBy({ left: scrollDistance, behavior: 'smooth' });
    });
    
    // Atualizar a visibilidade dos botões ao rolar
    modulesWrapper.addEventListener('scroll', checkScrollButtons);
    
    // Atualizar ao redimensionar a janela
    window.addEventListener('resize', checkScrollButtons);
    
    // Mostrar imediatamente o botão next se tiver scroll
    if (modulesWrapper.scrollWidth > modulesWrapper.clientWidth) {
        nextButton.classList.remove('hidden');
    }
}

// Função para inicializar o efeito de navegação transparente/sólida ao rolar
function initNavScrollEffect() {
    const nav = document.querySelector('nav');
    
    // Aplicar classe transparente inicialmente
    nav.classList.add('nav-transparent');
    
    // Função para verificar a posição do scroll
    function checkScroll() {
        if (window.scrollY > 50) {
            // Quando o usuário rolar para baixo, mudar para fundo sólido
            nav.classList.remove('nav-transparent');
            nav.classList.add('nav-solid');
        } else {
            // Quando estiver no topo, usar o fundo transparente
            nav.classList.add('nav-transparent');
            nav.classList.remove('nav-solid');
        }
    }
    
    // Verificar inicialmente
    checkScroll();
    
    // Adicionar listener de scroll
    window.addEventListener('scroll', checkScroll);
}

// Inicializa a página
window.onload = function() {
    loadCourseData();
    loadSupportEmail();
    loadPlatformName();
    initNavScrollEffect();
};

// Nova função para carregar o email de suporte
function loadSupportEmail() {
    fetch('/api/support-email')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.support_email) {
                document.getElementById('supportEmail').textContent = data.support_email;
                document.getElementById('supportEmailLink').href = `mailto:${data.support_email}`;
                document.getElementById('supportEmailLink').style.display = 'flex';
            } else {
                document.getElementById('supportEmailLink').style.display = 'none';
            }
        })
        .catch(error => console.error('Erro ao carregar email de suporte:', error));
}

// Nova função para carregar o platform_name e atualizar o footer
function loadPlatformName() {
    fetch('/dashboard', {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.platform_name) {
            document.getElementById('footerPlatformName').textContent = data.platform_name;
        }
    })
    .catch(error => console.error('Erro ao carregar platform name:', error));
}