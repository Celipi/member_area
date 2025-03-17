// Dashboard.js - JavaScript para a página de dashboard do aluno

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar ícones Lucide
    lucide.createIcons();

    // Configurar menu do usuário
    setupUserMenu();
    
    // Configurar alternância de visualização dos cursos
    setupViewToggle();
    
    // Configurar pesquisa de cursos
    setupCourseSearch();
    
    // Carregar cursos em destaque
    loadShowcaseCourses();
    
    // Verificar e mostrar promoções ativas
    checkForActivePromotions();
    
    // Carregar email de suporte
    loadSupportEmail();
    
    // Variáveis para armazenar dados do aluno
    let studentCourses = [];
    
    // Função para carregar os cursos do aluno
    async function loadStudentCourses() {
        try {
            const response = await fetch('/dashboard/student-courses');
            studentCourses = await response.json();
            return studentCourses;
        } catch (error) {
            console.error('Erro ao carregar os cursos do aluno:', error);
            return [];
        }
    }

    // Função para carregar os cursos em destaque (showcase)
    async function loadShowcaseCourses() {
        try {
            const response = await fetch('/api/showcase-courses');
            const data = await response.json();
            
            if (data.success && data.courses && data.courses.length > 0) {
                // Carregar cursos do aluno primeiro
                const myCourses = await loadStudentCourses();
                const myCourseIds = myCourses.map(course => course.id);
                
                // Filtrar os cursos da vitrine, removendo os que o aluno já possui
                showcaseCourses = data.courses.filter(course => !myCourseIds.includes(course.course_id));
                
                // Ordenar por prioridade (maior prioridade primeiro)
                showcaseCourses.sort((a, b) => b.priority - a.priority);
                
                // Renderizar os cursos em destaque
                renderShowcaseCourses();
            }
        } catch (error) {
            console.error('Error loading showcase courses:', error);
        }
    }
});

// Funções principais
function setupUserMenu() {
    const userMenuButton = document.getElementById('userMenuButton');
    const userDropdown = document.getElementById('userDropdown');
    
    userMenuButton.addEventListener('click', function() {
        userDropdown.classList.toggle('hidden');
    });
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(event) {
        if (!userMenuButton.contains(event.target) && !userDropdown.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    });
}

function setupViewToggle() {
    const gridView = document.getElementById('gridView');
    const listView = document.getElementById('listView');
    const coursesContainer = document.getElementById('myCoursesGrid');
    
    gridView.addEventListener('click', function() {
        coursesContainer.classList.remove('course-list-view');
        gridView.classList.add('active');
        listView.classList.remove('active');
        localStorage.setItem('courseViewPreference', 'grid');
    });
    
    listView.addEventListener('click', function() {
        coursesContainer.classList.add('course-list-view');
        listView.classList.add('active');
        gridView.classList.remove('active');
        localStorage.setItem('courseViewPreference', 'list');
    });
    
    // Verificar preferência salva
    const savedView = localStorage.getItem('courseViewPreference');
    if (savedView === 'list') {
        listView.click();
    }
}

function setupCourseSearch() {
    const courseSearch = document.getElementById('courseSearch');
    courseSearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const courseItems = document.querySelectorAll('#myCoursesGrid .course-item');
        
        courseItems.forEach(item => {
            const courseName = item.querySelector('.course-title').textContent.toLowerCase();
            if (courseName.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// Variável global para armazenar promoções a serem exibidas
let pendingPromotions = [];
let currentPromotionIndex = 0;

// Variável para armazenar os cursos da vitrine
let showcaseCourses = [];
let currentShowcaseItem = null;

// Função para verificar e mostrar promoções ativas
function checkForActivePromotions() {
    // Verificar se existe cache e se ainda é válido (menos de 1 hora)
    const promotionCache = JSON.parse(localStorage.getItem('promotionCache') || '{}');
    const currentTime = new Date().getTime();
    
    // Se temos um cache válido (menos de 1 hora / 3600000 ms), não mostrar os modais
    if (promotionCache.timestamp && (currentTime - promotionCache.timestamp) < 3600000) {
        console.log('Promotions were shown recently (cache valid for 1 hour). Skipping display.');
        return;
    }
    
    fetch('/api/active-promotions')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.promotions && data.promotions.length > 0) {
                // Salvar todas as promoções na variável global
                pendingPromotions = data.promotions;
                currentPromotionIndex = 0;
                
                // Mostrar a primeira promoção
                showPromotion(pendingPromotions[0]);
                
                // Salvar no cache com timestamp atual
                localStorage.setItem('promotionCache', JSON.stringify({
                    timestamp: currentTime,
                    promotionIds: pendingPromotions.map(p => p.id)
                }));
            }
        })
        .catch(error => console.error('Error fetching promotions:', error));
}

// Função para mostrar promoção
function showPromotion(promotion) {
    // Configurar os elementos da promoção
    document.getElementById('promotionTitle').textContent = promotion.title;
    document.getElementById('promotionDescription').innerHTML = promotion.description;
    
    const mediaContainer = document.getElementById('promotionMedia');
    
    // Limpar o conteúdo anterior
    mediaContainer.innerHTML = '';
    
    if (promotion.media_type === 'image') {
        // Configurar imagem
        const img = document.createElement('img');
        img.src = `/static/uploads/${promotion.media_url}`;
        img.alt = promotion.title;
        img.className = 'w-full h-auto rounded-lg';
        mediaContainer.appendChild(img);
        
        // Se tiver CTA com delay para imagem
        if (promotion.has_cta && promotion.button_delay > 0) {
            const ctaContainer = document.getElementById('promotionCTA');
            const ctaButton = document.getElementById('promotionCTAButton');
            
            setupCtaButton(ctaButton, promotion.cta_text, promotion.cta_url);
            ctaContainer.style.display = 'none';
            
            setTimeout(() => {
                ctaContainer.style.display = 'block';
                ctaContainer.classList.add('cta-button-animation');
            }, promotion.button_delay * 1000);
        }
    } else if (promotion.media_type === 'video') {
        // Configurar vídeo usando Vidstack
        setupVideo(promotion);
    }
    
    // Configurar CTA (Call to Action) se disponível e não for vídeo
    if (promotion.has_cta && promotion.media_type === 'image') {
        const ctaContainer = document.getElementById('promotionCTA');
        const ctaButton = document.getElementById('promotionCTAButton');
        
        setupCtaButton(ctaButton, promotion.cta_text, promotion.cta_url);
        
        if (promotion.button_delay === 0) {
            // Mostrar imediatamente se não tiver delay
            ctaContainer.style.display = 'block';
        }
    }
    
    // Mostrar o modal
    document.getElementById('promotionModal').style.display = 'block';
    
    // Remover qualquer handler existente para evitar duplicação
    const closeButton = document.getElementById('closePromotion');
    closeButton.replaceWith(closeButton.cloneNode(true));
    
    // Configurar evento para fechar e mostrar a próxima promoção se houver
    document.getElementById('closePromotion').addEventListener('click', function() {
        document.getElementById('promotionModal').style.display = 'none';
        
        // Verificar se há mais promoções para mostrar
        currentPromotionIndex++;
        if (currentPromotionIndex < pendingPromotions.length) {
            // Esperar um pequeno delay antes de mostrar a próxima promoção
            setTimeout(() => {
                showPromotion(pendingPromotions[currentPromotionIndex]);
            }, 500);
        }
    });
    
    // Fechar ao clicar fora do modal e mostrar a próxima promoção se houver
    const modal = document.getElementById('promotionModal');
    const modalClickHandler = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            
            // Remover o handler para evitar múltiplas chamadas
            window.removeEventListener('click', modalClickHandler);
            
            // Verificar se há mais promoções para mostrar
            currentPromotionIndex++;
            if (currentPromotionIndex < pendingPromotions.length) {
                // Esperar um pequeno delay antes de mostrar a próxima promoção
                setTimeout(() => {
                    showPromotion(pendingPromotions[currentPromotionIndex]);
                }, 500);
            }
        }
    };
    
    // Adicionar o handler
    window.addEventListener('click', modalClickHandler);
    
    // Inicializar os ícones Lucide nos botões
    lucide.createIcons();
}

// Função auxiliar para configurar o botão CTA com o novo design
function setupCtaButton(button, text, url) {
    button.href = url;
    
    // Limpar o conteúdo atual do botão e criar nova estrutura
    button.innerHTML = `
        <span class="cta-shimmer"></span>
        <i data-lucide="external-link" class="h-6 w-6 mr-3 text-white"></i>
        <span class="text-xl font-bold text-white">${text || 'Clique aqui'}</span>
        <i data-lucide="chevron-right" class="h-6 w-6 ml-3 text-white"></i>
    `;
}

// Função para configurar vídeo utilizando Vidstack
function setupVideo(promotion) {
    const mediaContainer = document.getElementById('promotionMedia');
    const ctaContainer = document.getElementById('promotionCTA');
    const ctaButton = document.getElementById('promotionCTAButton');
    
    if (promotion.has_cta) {
        setupCtaButton(ctaButton, promotion.cta_text, promotion.cta_url);
        // Se button_delay for 0, exibe o CTA imediatamente; caso contrário, inicia oculto
        ctaContainer.style.display = promotion.button_delay === 0 ? 'block' : 'none';
    } else {
        ctaContainer.style.display = 'none';
    }
    
    mediaContainer.innerHTML = `
            <div class="relative aspect-video bg-black">
                <div id="target"></div>
            </div>
        `;
        
    const scriptElement = document.createElement('script');
    scriptElement.type = 'module';
    scriptElement.innerHTML = `
        import { PlyrLayout, VidstackPlayer } from 'https://cdn.vidstack.io/player';

        function getYouTubeVideoId(url) {
            const regExp = /^.*(youtu.be\\/|v\\/u\\/\\w\\/|embed\\/|watch\\?v=|\\&v=)([^#\\&\\?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        }

        const videoUrl = "${promotion.media_url}";
        const videoId = getYouTubeVideoId(videoUrl);

        const layout = new PlyrLayout({ 
            controls: ${!promotion.hide_video_controls ? '["play", "progress", "volume", "fullscreen"]' : '[]'}
        });

        const player = await VidstackPlayer.create({
            target: '#target',
            title: '${promotion.title}',
            src: videoUrl,
            poster: videoId ? \`https://i3.ytimg.com/vi/\${videoId}/maxresdefault.jpg\` : '',
            layout: layout,
            playsinline: true
        });

        ${promotion.has_cta && promotion.button_delay > 0 ? `
        const buttonShowTime = ${promotion.button_delay};
        const ctaButtonContainer = document.getElementById('promotionCTA');
        let unsubscribe;

        function checkTime({ currentTime }) {
            if (currentTime >= buttonShowTime) {
                ctaButtonContainer.style.display = 'block';
                ctaButtonContainer.classList.add('cta-button-animation');
                if (unsubscribe) {
                    unsubscribe();
                }
            }
        }

        unsubscribe = player.subscribe(checkTime);
        ` : ''}
    `;
    document.body.appendChild(scriptElement);
}

// Função para criar um card de curso
function createCourseCard(course) {
    return `
        <a href="/course/${course.id}" class="course-item group">
            <div class="relative overflow-hidden rounded-t-lg">
                <img src="/static/uploads/${course.image || 'placeholder.jpg'}" alt="${course.name}" 
                    class="course-image w-full h-[160px] object-cover transition-transform duration-300 group-hover:scale-110">
                <div class="absolute bottom-0 left-0 bg-gradient-to-t from-gray-900 to-transparent w-full h-16"></div>
            </div>
            <div class="course-content p-4">
                <h3 class="course-title text-lg font-semibold mb-2">${course.name}</h3>
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <div class="bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium px-3 py-1 rounded-full cursor-pointer">
                            <i data-lucide="play" class="h-3 w-3 inline mr-1"></i> Acessar
                        </div>
                    </div>
                    <div class="text-sm text-gray-500">
                        <i data-lucide="bar-chart-2" class="h-4 w-4 inline mr-1"></i>
                        <span id="progress_${course.id}">...</span>
                    </div>
                </div>
            </div>
        </a>
    `;
}

// Função para carregar o nome da plataforma e do aluno
function loadPlatformAndStudentName() {
    fetch('/dashboard', {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.platform_name) {
            document.getElementById('platformName').textContent = data.platform_name;
            document.getElementById('footerPlatformName').textContent = data.platform_name;
        }
        if (data.student_name) {
            document.getElementById('studentName').textContent = data.student_name;
            document.getElementById('studentNameNav').textContent = data.student_name;
        }
        
        // Configuração do botão "Continuar Aprendendo"
        setupContinueButton();
    })
    .catch(error => console.error('Erro ao carregar os dados:', error));
}

// Configurar botão "Continuar Aprendendo"
function setupContinueButton() {
    const continueButton = document.getElementById('continueButton');
    if (continueButton) {
        continueButton.addEventListener('click', function() {
            const firstCourse = document.querySelector('#myCoursesGrid .course-item');
            if (firstCourse) {
                firstCourse.click();
            }
        });
    }
}

// Função para carregar os cursos do aluno
function loadStudentCourses() {
    // Primeiro carregar os cursos
    fetch('/dashboard/student-courses')
        .then(response => response.json())
        .then(courses => {
            const myCoursesGrid = document.getElementById('myCoursesGrid');
            
            // Se não houver cursos, exibir mensagem
            if (courses.length === 0) {
                myCoursesGrid.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <img src="/static/fixed/favicon.webp" alt="No courses" class="w-16 h-16 mx-auto mb-4 opacity-50">
                        <p class="text-gray-500">Você ainda não tem cursos ativos.</p>
                        <p class="text-gray-400 text-sm mt-2">Entre em contato com o suporte para mais informações.</p>
                    </div>
                `;
                return;
            }

            // Renderizar os cards dos cursos
            myCoursesGrid.innerHTML = courses.map(createCourseCard).join('');
            document.getElementById('activeCourses').textContent = courses.length;

            // Carregar o progresso geral
            fetch('/dashboard/student-progress')
                .then(response => response.json())
                .then(progress => {
                    document.getElementById('completedLessons').textContent = progress.completed_lessons;
                    document.getElementById('overallProgress').textContent = progress.progress_percentage + '%';
                })
                .catch(error => console.error('Erro ao carregar progresso geral:', error));

            // Carregar progresso individual de cada curso
            courses.forEach(course => {
                fetch(`/api/course/${course.id}/progress`)
                    .then(response => response.json())
                    .then(progress => {
                        const progressSpan = document.getElementById(`progress_${course.id}`);
                        if (progressSpan) {
                            progressSpan.textContent = progress.progress_percentage + '%';
                        }
                    })
                    .catch(error => console.error(`Erro ao carregar progresso do curso ${course.id}:`, error));
            });
            
            // Aplicar ícones após adicionar o conteúdo
            lucide.createIcons();
        })
        .catch(error => console.error('Erro ao carregar os cursos do aluno:', error));
}

// Função para carregar os cursos em destaque (showcase)
function loadShowcaseCourses() {
    fetch('/api/showcase-courses')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.courses && data.courses.length > 0) {
                // Armazenar os cursos em destaque na variável global
                showcaseCourses = data.courses;
                
                // Ordenar por prioridade (maior prioridade primeiro)
                showcaseCourses.sort((a, b) => b.priority - a.priority);
                
                // Renderizar os cursos em destaque
                renderShowcaseCourses();
            }
        })
        .catch(error => {
            console.error('Error loading showcase courses:', error);
        });
}

// Função para renderizar os cursos em destaque na interface
function renderShowcaseCourses() {
    const container = document.getElementById('featuredCourses');
    const placeholder = document.getElementById('noFeaturedPlaceholder');
    
    if (showcaseCourses.length === 0) {
        placeholder.style.display = 'block';
        return;
    }
    
    // Ocultar o placeholder
    placeholder.style.display = 'none';
    
    // Renderizar cada curso em destaque
    let showcaseHTML = '';
    
    showcaseCourses.forEach((course, index) => {
        showcaseHTML += createShowcaseItem(course, index);
    });
    
    container.innerHTML = showcaseHTML;
    
    // Adicionar os event listeners aos botões de desbloqueio após renderizar
    showcaseCourses.forEach((course, index) => {
        const unlockButton = document.getElementById(`unlockShowcase_${index}`);
        if (unlockButton) {
            unlockButton.addEventListener('click', function(e) {
                e.preventDefault();
                showShowcaseModal(course);
            });
        }
    });
    
    // Reinicializar ícones
    lucide.createIcons();
}

// Função para criar um item de vitrine
function createShowcaseItem(course, index) {
    return `
        <div class="showcase-item bg-white rounded-lg overflow-hidden">
            <div class="showcase-badge">
                <i data-lucide="sparkles" class="h-3 w-3 inline mr-1"></i>
                Conteúdo Exclusivo
            </div>
            <div class="relative">
                <img src="/static/uploads/${course.image || 'placeholder.jpg'}" alt="${course.name}" 
                    class="w-full h-[180px] object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div class="absolute bottom-0 left-0 w-full p-4">
                    <h3 class="text-white font-bold text-lg line-clamp-1">${course.name}</h3>
                </div>
            </div>
            <div class="showcase-locked">
                <i data-lucide="lock" class="h-8 w-8 mb-3"></i>
                <p class="font-medium mb-3 px-4 text-center">Conteúdo adicional disponível para você!</p>
                <button id="unlockShowcase_${index}" class="unlock-button">
                    <i data-lucide="unlock" class="h-4 w-4 mr-1 inline"></i>
                    Desbloquear
                </button>
            </div>
        </div>
    `;
}

// Função para mostrar o modal do showcase
function showShowcaseModal(course) {
    // Enviar visualização (views) ao abrir o modal
    fetch(`/api/showcase/${course.id}/analytics/view`, { method: 'POST' })
       .then(res => res.json())
       .then(data => console.log('Showcase view updated:', data))
       .catch(err => console.error('Error updating showcase view:', err));
    
    // Armazenar o curso atual que está sendo exibido
    currentShowcaseItem = course;
    
    // Configurar o título
    document.getElementById('showcaseTitle').textContent = course.name;
    
    // Configurar a descrição
    document.getElementById('showcaseDescription').innerHTML = course.description;
    
    // Configurar a tag de preço se não houver delay no botão
    const priceTag = document.getElementById('showcasePriceTag');
    if (course.button_delay === 0 && course.price) {
        // Adicionar o prefixo R$ ao preço se ainda não tiver
        const priceText = course.price.startsWith('R$') ? course.price : `R$ ${course.price}`;
        priceTag.textContent = priceText;
        priceTag.style.display = 'block';
    } else {
        priceTag.style.display = 'none';
    }
    
    const mediaContainer = document.getElementById('showcaseMedia');
    
    // Limpar o conteúdo anterior
    mediaContainer.innerHTML = '';
    
    // Configurar o conteúdo de mídia (imagem ou vídeo)
    if (course.has_video && course.video_url) {
        setupShowcaseVideo(course);
    } else {
        // Configurar imagem
        const img = document.createElement('img');
        img.src = `/static/uploads/${course.image}`;
        img.alt = course.name;
        img.className = 'w-full h-auto rounded-lg shadow-lg';
        mediaContainer.appendChild(img);
        
        // Mostrar o botão de compra (com delay se configurado)
        setupShowcasePurchaseButton(course);
    }
    
    // Mostrar o modal
    document.getElementById('showcaseModal').style.display = 'block';
    
    // Fechar ao clicar fora do modal
    const modal = document.getElementById('showcaseModal');
    const modalClickHandler = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            window.removeEventListener('click', modalClickHandler);
        }
    };
    
    window.addEventListener('click', modalClickHandler);
    
    // Inicializar os ícones Lucide
    lucide.createIcons();
    
    const purchaseButton = document.getElementById('purchaseButton');
    
    // Configurar o botão de compra (já existente)
    purchaseButton.href = course.button_link || '#';
    purchaseButton.innerHTML = `
        <span class="purchase-shimmer"></span>
        <i data-lucide="unlock" class="h-6 w-6 mr-3 text-white"></i>
        <span class="text-xl font-bold text-white">${course.button_text || 'Desbloquear'}</span>
    `;
    
    // Modificar o listener: enviar conversão e abrir em nova guia
    purchaseButton.addEventListener('click', function(e) {
        e.preventDefault();
        fetch(`/api/showcase/${course.id}/analytics/checkout`, { method: 'POST' })
          .then(response => response.json())
          .then(data => {
              console.log('Showcase conversion updated:', data);
              window.open(purchaseButton.href, '_blank');
          })
          .catch(err => {
              console.error('Error updating conversion:', err);
              window.open(purchaseButton.href, '_blank');
          });
    });
}

// Função para configurar o vídeo do showcase
function setupShowcaseVideo(course) {
    const mediaContainer = document.getElementById('showcaseMedia');
    
    // Container para o vídeo
    mediaContainer.innerHTML = `
        <div class="relative aspect-video bg-black rounded-lg overflow-hidden">
            <div id="showcaseVideoTarget"></div>
        </div>
    `;
    
    // Configurar o botão de compra
    const purchaseButtonContainer = document.getElementById('purchaseButtonContainer');
    const purchaseButton = document.getElementById('purchaseButton');
    
    // Configurar o botão de compra
    purchaseButton.href = course.button_link || '#';
    purchaseButton.innerHTML = `
        <span class="purchase-shimmer"></span>
        <i data-lucide="unlock" class="h-6 w-6 mr-3 text-white"></i>
        <span class="text-xl font-bold text-white">${course.button_text || 'Desbloquear'}</span>
    `;
    
    if (course.button_delay > 0) {
        // Inicialmente esconder o botão se tiver delay
        purchaseButtonContainer.style.display = 'none';
    } else {
        purchaseButtonContainer.style.display = 'block';
    }
    
    // Adicionar script inline para carregar o vidstack player
    const scriptElement = document.createElement('script');
    scriptElement.type = 'module';
    scriptElement.innerHTML = `
        import { PlyrLayout, VidstackPlayer } from 'https://cdn.vidstack.io/player';

        function getYouTubeVideoId(url) {
            const regExp = /^.*(youtu.be\\/|v\\/u\\/\\w\\/|embed\\/|watch\\?v=|\\&v=)([^#\\&\\?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        }

        const videoUrl = "${course.video_url}";
        const videoId = getYouTubeVideoId(videoUrl);

        // Player sempre sem controles para o showcase
        const layout = new PlyrLayout({ controls: [] });

        const player = await VidstackPlayer.create({
            target: '#showcaseVideoTarget',
            title: '${course.name}',
            src: videoUrl,
            poster: videoId ? \`https://i3.ytimg.com/vi/\${videoId}/maxresdefault.jpg\` : '',
            layout: layout,
            playsinline: true  // Força reprodução inline em dispositivos móveis
        });

        ${course.button_delay > 0 ? `
        const buttonShowTime = ${course.button_delay};
        const buttonContainer = document.getElementById('purchaseButtonContainer');
        let unsubscribe;

        function checkTime({ currentTime }) {
            if (currentTime >= buttonShowTime) {
                buttonContainer.style.display = 'block';
                buttonContainer.classList.add('cta-button-animation');
                if (unsubscribe) {
                    unsubscribe();
                }
            }
        }

        unsubscribe = player.subscribe(checkTime);
        ` : ''}
    `;
    document.body.appendChild(scriptElement);
}

// Função para configurar o botão de compra para uma imagem
function setupShowcasePurchaseButton(course) {
    const purchaseButtonContainer = document.getElementById('purchaseButtonContainer');
    const purchaseButton = document.getElementById('purchaseButton');
    
    // Configurar o botão de compra
    purchaseButton.href = course.button_link || '#';
    purchaseButton.innerHTML = `
        <span class="purchase-shimmer"></span>
        <i data-lucide="unlock" class="h-6 w-6 mr-3 text-white"></i>
        <span class="text-xl font-bold text-white">${course.button_text || 'Desbloquear'}</span>
    `;
    
    if (course.button_delay > 0) {
        // Inicialmente esconder o botão se tiver delay
        
        purchaseButtonContainer.style.display = 'none';
        
        // Mostrar após o delay
        setTimeout(() => {
            purchaseButtonContainer.style.display = 'block';
            purchaseButtonContainer.classList.add('cta-button-animation');
        }, course.button_delay * 1000);
    } else {
        purchaseButtonContainer.style.display = 'block';
    }
}

// Função para carregar email de suporte
function loadSupportEmail() {
    fetch('/api/support-email')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.support_email) {
                document.getElementById('supportEmail').textContent = data.support_email;
                document.getElementById('supportEmailLink').href = `mailto:${data.support_email}`;
                document.getElementById('supportEmailLink').style.display = 'flex';
            }
        })
        .catch(error => console.error('Erro ao carregar email de suporte:', error));
}

// Inicializar os dados quando a página carregar
window.onload = function() {
    loadPlatformAndStudentName();
    loadStudentCourses();
};