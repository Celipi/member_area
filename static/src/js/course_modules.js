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
    fetch(`/api/course/${courseId}`)
        .then(response => response.json())
        .then(data => {
            populateCourseData(data);
            populateModules(data.modules);
            // Animar a barra de progresso após carregar os dados
            animateProgressBar(data.completedLessons, data.totalLessons);
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
    document.getElementById('courseTitle').textContent = courseData.title;
    document.getElementById('courseDescription').textContent = courseData.description;
    
    const progressPercentage = (courseData.completedLessons / courseData.totalLessons) * 100;
    document.getElementById('courseProgress').style.width = `${progressPercentage}%`;
    document.getElementById('courseCompletion').textContent = `${courseData.completedLessons} de ${courseData.totalLessons} aulas concluídas (${progressPercentage.toFixed(1)}%)`;
    
    // Tenta carregar o cover
    var coverUrl = `/static/uploads/cover_${courseData.id}.jpg`;
    var img = new Image();
    img.onload = function(){
        let courseHeader = document.getElementById('courseHeader');
        courseHeader.style.backgroundImage = `url(${coverUrl})`;
        courseHeader.style.backgroundSize = "cover";
        courseHeader.style.backgroundPosition = "center";
        // Removemos o filter do container; o overlay cuidará do brilho
    };
    img.onerror = function(){
        // Se não existir, mantém o background atual (bg-gradient-custom)
    };
    img.src = coverUrl;
    
    // Atualizar nome da plataforma se disponível
    if (courseData.platform_name) {
        const platformName = courseData.platform_name;
        // Atualizar no header
        const platformNameElement = document.getElementById('platformName');
        if (platformNameElement) {
            platformNameElement.textContent = platformName;
        }
        
        // Atualizar no footer
        const footerPlatformNameElement = document.getElementById('footerPlatformName');
        if (footerPlatformNameElement) {
            footerPlatformNameElement.textContent = platformName;
        }
        
        // Atualizar título da página
        document.title = `${courseData.title} | ${platformName}`;
    }
}

// Função para criar um card de módulo
function createModuleCard(module) {
    const courseId = getCourseId();
    const moduleUrl = `/course/${courseId}/module/${module.id}/lesson/1`;
    
    return `
        <div class="module-card group cursor-pointer" onclick="window.location.href='${moduleUrl}'">
            <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                <div class="relative overflow-hidden">
                    <img src="/static/uploads/${module.image}" alt="${module.title}" 
                        class="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-50 group-hover:opacity-70 transition-opacity duration-300"></div>
                    <div class="absolute bottom-4 left-4 bg-primary px-3 py-1 rounded-full text-sm text-white flex items-center">
                        <i data-lucide="book-open" class="h-3 w-3 mr-1"></i>
                        ${module.lessons.length} aula${module.lessons.length !== 1 ? 's' : ''}
                    </div>
                </div>
                
                <div class="p-6 flex flex-col flex-grow">
                    <h3 class="text-lg font-bold text-gray-800 mb-3 group-hover:text-primary transition-colors">${module.title}</h3>
                    <div class="mt-auto pt-4">
                        <a href="${moduleUrl}" 
                           class="bg-primary hover:bg-red-700 text-white px-4 py-2.5 rounded-md flex items-center justify-center w-full transition-colors"
                           onclick="event.stopPropagation()">
                            <i data-lucide="play" class="mr-2 h-4 w-4"></i> Iniciar Módulo
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Função para preencher os módulos
function populateModules(modules) {
    const modulesGrid = document.getElementById('modulesGrid');
    
    if (modules.length === 0) {
        modulesGrid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12">
                <i data-lucide="file-question" class="h-16 w-16 text-gray-300 mb-4"></i>
                <p class="text-gray-500 text-lg">Nenhum módulo disponível neste curso</p>
                <p class="text-gray-400 text-sm mt-2">Volte mais tarde para verificar atualizações</p>
            </div>
        `;
    } else {
        modulesGrid.innerHTML = modules.map(createModuleCard).join('');
    }
    
    lucide.createIcons(); // Reinicializa os ícones após adicionar novo conteúdo
}

// Inicializa a página
window.onload = function() {
    loadCourseData();
    loadSupportEmail(); // Nova chamada para exibir ou ocultar o email de suporte
    loadPlatformName(); // Nova chamada para atualizar platform_name no footer
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