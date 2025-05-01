// Inicializa os ícones do Lucide
lucide.createIcons();

// Função para obter o ID do curso da URL
function getCourseId() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

// Variável global para armazenar os cursos da vitrine
let showcaseCourses = [];
let currentShowcaseItem = null;

// Função para carregar os dados do curso
function loadCourseData() {
    const courseId = getCourseId();
    fetch(`/api/course/${courseId}`)
        .then(response => response.json())
        .then(data => {
            populateCourseData(data);
            populateModules(data.modules);
        })
        .catch(error => console.error('Erro ao carregar dados do curso:', error));
}

// Função para preencher os dados do curso
function populateCourseData(courseData) {
    const courseHeader = document.getElementById('courseHeader');
    let coverUrl = `/static/uploads/cover_${courseData.id}.jpg`;
    let mobileCoverUrl = `/static/uploads/cover_${courseData.id}_mobile.jpg`;
    let coverFound = false;
    // Detecta se é mobile
    const isMobile = window.innerWidth <= 768;
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
        document.title = `${courseData.title} | ${platformName}`;
    }
}

// Função para criar um card de módulo (agora apenas com imagem)
function createModuleCard(module) {
    const courseId = getCourseId();
    const moduleUrl = `/course/${courseId}/module/${module.id}/lesson/1`;
    
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
                window.location.href = `/course/${getCourseId()}/module/${module.id}/lesson/1`;
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

// Função para inicializar os controles de navegação para um bloco específico
function initNavigationControlsForBlock(modulesWrapper, prevButton, nextButton) {
    const checkScrollButtons = () => {
        if (modulesWrapper.scrollWidth > modulesWrapper.clientWidth) {
            if (modulesWrapper.scrollLeft > 20) {
                prevButton.classList.remove('hidden');
            } else {
                prevButton.classList.add('hidden');
            }
            const maxScrollLeft = modulesWrapper.scrollWidth - modulesWrapper.clientWidth;
            if (modulesWrapper.scrollLeft < maxScrollLeft - 20) {
                nextButton.classList.remove('hidden');
            } else {
                nextButton.classList.add('hidden');
            }
        } else {
            prevButton.classList.add('hidden');
            nextButton.classList.add('hidden');
        }
    };
    setTimeout(checkScrollButtons, 300);
    prevButton.addEventListener('click', () => {
        const scrollDistance = Math.min(modulesWrapper.clientWidth * 0.8, 800);
        modulesWrapper.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
    });
    nextButton.addEventListener('click', () => {
        const scrollDistance = Math.min(modulesWrapper.clientWidth * 0.8, 800);
        modulesWrapper.scrollBy({ left: scrollDistance, behavior: 'smooth' });
    });
    modulesWrapper.addEventListener('scroll', checkScrollButtons);
    window.addEventListener('resize', checkScrollButtons);
    if (modulesWrapper.scrollWidth > modulesWrapper.clientWidth) {
        nextButton.classList.remove('hidden');
    }
}

// Função para renderizar todos os cursos do aluno
async function loadAllStudentCourses() {
    // Pega o ID do curso principal da URL
    const mainCourseId = getCourseId();
    // Atualiza o cover e título do curso principal normalmente
    let mainCourseData = null;
    try {
        const res = await fetch(`/api/course/${mainCourseId}`);
        mainCourseData = await res.json();
    } catch (e) {
        // Se der erro, mostra mensagem e para
        const mainContent = document.querySelector('.w-full.px-3.py-0.flex-grow');
        if (mainContent) mainContent.innerHTML = '<div class="text-center text-gray-400 py-8">Erro ao carregar o curso principal.</div>';
        return;
    }
    // Atualiza o cover e título do curso principal
    populateCourseData(mainCourseData);

    // Container principal onde os cursos serão renderizados
    const mainContent = document.querySelector('.w-full.px-3.py-0.flex-grow');
    if (!mainContent) return;
    mainContent.innerHTML = '';

    // Buscar todos os cursos do aluno
    let courses = [];
    try {
        const res = await fetch('/dashboard/student-courses');
        courses = await res.json();
    } catch (e) {
        mainContent.innerHTML = '<div class="text-center text-gray-400 py-8">Erro ao carregar cursos.</div>';
        return;
    }

    if (!Array.isArray(courses) || courses.length === 0) {
        mainContent.innerHTML = '<div class="text-center text-gray-400 py-8">Você não possui cursos disponíveis.</div>';
        return;
    }

    // Renderiza o curso principal primeiro (com título e módulos)
    const mainCourse = courses.find(c => String(c.id) === String(mainCourseId));
    if (mainCourse) {
        const courseBlock = document.createElement('div');
        courseBlock.className = 'mb-12';
        // Wrapper dos módulos
        const modulesContainer = document.createElement('div');
        modulesContainer.className = 'modules-container px-2';
        // Botões de navegação
        const prevButton = document.createElement('div');
        prevButton.className = 'nav-arrow prev hidden';
        prevButton.innerHTML = '<i data-lucide="chevron-left" class="h-7 w-7"></i>';
        const nextButton = document.createElement('div');
        nextButton.className = 'nav-arrow next hidden';
        nextButton.innerHTML = '<i data-lucide="chevron-right" class="h-7 w-7"></i>';
        modulesContainer.appendChild(prevButton);
        modulesContainer.appendChild(nextButton);
        // Wrapper dos módulos
        const modulesWrapper = document.createElement('div');
        modulesWrapper.className = 'modulesWrapper flex gap-4 overflow-x-auto pb-4';
        modulesWrapper.id = 'modulesWrapper';
        modulesContainer.appendChild(modulesWrapper);
        courseBlock.appendChild(modulesContainer);
        // Renderiza os módulos do curso principal
        if (mainCourseData && Array.isArray(mainCourseData.modules) && mainCourseData.modules.length > 0) {
            mainCourseData.modules.forEach((module, index) => {
                const moduleElement = document.createElement('div');
                moduleElement.className = 'module-card cursor-pointer';
                moduleElement.onclick = function() {
                    window.location.href = `/course/${mainCourseId}/module/${module.id}/lesson/1`;
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
        } else {
            modulesWrapper.innerHTML = `<div class='w-full flex flex-col items-center justify-center py-12'><i data-lucide="file-question" class="h-16 w-16 text-gray-300 mb-4"></i><p class="text-gray-300 text-lg">Nenhum módulo disponível neste curso</p><p class="text-gray-400 text-sm mt-2">Volte mais tarde para verificar atualizações</p></div>`;
        }
        mainContent.appendChild(courseBlock);
        // Inicializa navegação para este bloco
        initNavigationControlsForBlock(modulesWrapper, prevButton, nextButton);
    }

    // Renderiza os outros cursos do aluno (exceto o principal)
    for (const course of courses) {
        if (String(course.id) === String(mainCourseId)) continue;
        const courseBlock = document.createElement('div');
        courseBlock.className = 'mb-12';
        const titleDiv = document.createElement('div');
        titleDiv.className = 'container pl-6';
        titleDiv.innerHTML = `<div class="course-title-container px-2 mb-2"><h3 class="text-2xl"><span>${course.name}</span></h3></div>`;
        courseBlock.appendChild(titleDiv);
        const modulesContainer = document.createElement('div');
        modulesContainer.className = 'modules-container px-2';
        // Botões de navegação
        const prevButton = document.createElement('div');
        prevButton.className = 'nav-arrow prev hidden';
        prevButton.innerHTML = '<i data-lucide="chevron-left" class="h-7 w-7"></i>';
        const nextButton = document.createElement('div');
        nextButton.className = 'nav-arrow next hidden';
        nextButton.innerHTML = '<i data-lucide="chevron-right" class="h-7 w-7"></i>';
        modulesContainer.appendChild(prevButton);
        modulesContainer.appendChild(nextButton);
        const modulesWrapper = document.createElement('div');
        modulesWrapper.className = 'modulesWrapper flex gap-4 overflow-x-auto pb-4';
        modulesContainer.appendChild(modulesWrapper);
        courseBlock.appendChild(modulesContainer);
        let courseData = null;
        try {
            const res = await fetch(`/api/course/${course.id}`);
            courseData = await res.json();
        } catch (e) {
            modulesWrapper.innerHTML = '<div class="text-gray-400 py-8">Erro ao carregar módulos.</div>';
        }
        if (courseData && Array.isArray(courseData.modules) && courseData.modules.length > 0) {
            courseData.modules.forEach((module, index) => {
                const moduleElement = document.createElement('div');
                moduleElement.className = 'module-card cursor-pointer';
                moduleElement.onclick = function() {
                    window.location.href = `/course/${course.id}/module/${module.id}/lesson/1`;
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
        } else {
            modulesWrapper.innerHTML = `<div class='w-full flex flex-col items-center justify-center py-12'><i data-lucide="file-question" class="h-16 w-16 text-gray-300 mb-4"></i><p class="text-gray-300 text-lg">Nenhum módulo disponível neste curso</p><p class="text-gray-400 text-sm mt-2">Volte mais tarde para verificar atualizações</p></div>`;
        }
        mainContent.appendChild(courseBlock);
        // Inicializa navegação para este bloco
        initNavigationControlsForBlock(modulesWrapper, prevButton, nextButton);
    }

    // Buscar os cursos da vitrine
    const userCourseIds = courses.map(c => c.id);
    const showcaseCourses = await fetchShowcaseCourses(userCourseIds);
    
    // Renderizar os módulos dos cursos da vitrine como bloqueados
    if (showcaseCourses.length > 0) {
        // Criar um bloco para os cursos disponíveis na vitrine
        const showcaseBlock = document.createElement('div');
        showcaseBlock.className = 'mb-12';
        
        // Adicionar título para a seção
        const titleDiv = document.createElement('div');
        titleDiv.className = 'container pl-6';
        titleDiv.innerHTML = `<div class="course-title-container px-2 mb-2">
            <h3 class="text-2xl">
                <span class="flex items-center">
                    <i data-lucide="shopping-bag" class="h-5 w-5 mr-2 text-primary"></i>
                    Cursos Disponíveis
                </span>
            </h3>
            <p class="text-gray-400 text-sm mt-2">Conteúdo adicional que você pode desbloquear</p>
        </div>`;
        showcaseBlock.appendChild(titleDiv);
        
        // Renderizar cada curso da vitrine com seus módulos bloqueados
        for (const showcaseCourse of showcaseCourses) {
            const courseTitle = document.createElement('div');
            courseTitle.className = 'container pl-6 mt-4';
            courseTitle.innerHTML = `<div class="px-2 mb-2"><h4 class="text-xl text-gray-300"><span>${showcaseCourse.name}</span></h4></div>`;
            showcaseBlock.appendChild(courseTitle);
            
            // Container para os módulos
            const modulesContainer = document.createElement('div');
            modulesContainer.className = 'modules-container px-2';
            
            // Botões de navegação para este curso da vitrine
            const prevButton = document.createElement('div');
            prevButton.className = 'nav-arrow prev hidden';
            prevButton.innerHTML = '<i data-lucide="chevron-left" class="h-7 w-7"></i>';
            
            const nextButton = document.createElement('div');
            nextButton.className = 'nav-arrow next hidden';
            nextButton.innerHTML = '<i data-lucide="chevron-right" class="h-7 w-7"></i>';
            
            modulesContainer.appendChild(prevButton);
            modulesContainer.appendChild(nextButton);
            
            // Wrapper para os módulos
            const modulesWrapper = document.createElement('div');
            modulesWrapper.className = 'modulesWrapper flex gap-4 overflow-x-auto pb-4';
            
            // Adicionar os módulos bloqueados do curso da vitrine
            if (showcaseCourse.modules && showcaseCourse.modules.length > 0) {
                showcaseCourse.modules.forEach(module => {
                    const moduleElement = document.createElement('div');
                    moduleElement.className = 'module-card locked-module cursor-pointer';
                    moduleElement.setAttribute('data-showcase-course-id', showcaseCourse.id);
                    moduleElement.innerHTML = `
                        <div class="w-full h-full" style="aspect-ratio: auto; position: relative;">
                            <img 
                                src="/static/uploads/${module.image}" 
                                alt="${module.title}" 
                                class="module-image"
                                onload="adjustModuleImageSize(this)"
                            >
                            <div class="module-lock-overlay">
                                <div class="lock-icon-container">
                                    <i data-lucide="lock" class="h-10 w-10 text-white"></i>
                                    <p class="text-sm text-white font-medium mt-2">Clique para desbloquear</p>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Adicionar evento de clique para abrir o modal da vitrine
                    moduleElement.addEventListener('click', () => {
                        showShowcaseModal(showcaseCourse);
                    });
                    
                    modulesWrapper.appendChild(moduleElement);
                });
            } else {
                modulesWrapper.innerHTML = `<div class='w-full flex flex-col items-center justify-center py-12'><i data-lucide="file-question" class="h-16 w-16 text-gray-300 mb-4"></i><p class="text-gray-300 text-lg">Nenhum módulo disponível neste curso</p><p class="text-gray-400 text-sm mt-2">Volte mais tarde para verificar atualizações</p></div>`;
            }
            
            modulesContainer.appendChild(modulesWrapper);
            showcaseBlock.appendChild(modulesContainer);
            
            // Inicializar navegação para este bloco
            initNavigationControlsForBlock(modulesWrapper, prevButton, nextButton);
        }
        
        mainContent.appendChild(showcaseBlock);
    }
    
    // Reinicializar ícones Lucide
    lucide.createIcons();
}

// Função para buscar cursos da vitrine não possuídos pelo usuário
async function fetchShowcaseCourses(userCourseIds) {
    try {
        const response = await fetch('/api/showcase-courses');
        const data = await response.json();
        
        if (data.success && data.courses && data.courses.length > 0) {
            // Filtrar apenas os cursos que o usuário não possui
            const filteredCourses = data.courses.filter(course => !userCourseIds.includes(course.course_id));
            
            // Buscar detalhes dos módulos para cada curso da vitrine
            const coursesWithModules = await Promise.all(filteredCourses.map(async (course) => {
                try {
                    const courseDetailsResponse = await fetch(`/api/course/${course.course_id}`);
                    const courseDetails = await courseDetailsResponse.json();
                    
                    return {
                        ...course,
                        name: courseDetails.title || course.name,
                        modules: courseDetails.modules || []
                    };
                } catch (error) {
                    console.error(`Erro ao buscar detalhes do curso ${course.course_id}:`, error);
                    return {
                        ...course,
                        modules: []
                    };
                }
            }));
            
            // Ordenar por prioridade (maior prioridade primeiro)
            return coursesWithModules.sort((a, b) => b.priority - a.priority);
        }
        return [];
    } catch (error) {
        console.error('Erro ao carregar cursos da vitrine:', error);
        return [];
    }
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
    
    // Mostrar o modal usando os novos estilos
    const modal = document.getElementById('showcaseModal');
    modal.style.display = 'flex'; // Use flex for centering
    modal.classList.add('active');
    
    // Fechar ao clicar fora do modal ou no botão de fechar
    const closeModal = () => {
        modal.style.display = 'none';
        modal.classList.remove('active');
    };
    
    // Set up close button if it exists
    const closeButton = document.getElementById('showcaseModalClose');
    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }
    
    // Click outside to close
    const modalClickHandler = function(event) {
        if (event.target === modal) {
            closeModal();
            window.removeEventListener('click', modalClickHandler);
        }
    };
    
    window.addEventListener('click', modalClickHandler);
    
    // Inicializar os ícones Lucide
    lucide.createIcons();
    
    // Setup purchase button
    const purchaseButton = document.getElementById('purchaseButton');
    
    // Limpar listeners anteriores
    const newButton = purchaseButton.cloneNode(true);
    purchaseButton.parentNode.replaceChild(newButton, purchaseButton);
    
    // Configurar o botão de compra
    newButton.href = course.button_link || '#';
    newButton.innerHTML = `
        <span class="purchase-shimmer"></span>
        <i data-lucide="unlock" class="h-6 w-6 mr-3 text-white"></i>
        <span class="text-xl font-bold text-white">${course.button_text || 'Desbloquear'}</span>
    `;
    
    // Adicionar novo listener: enviar conversão e abrir em nova guia
    newButton.addEventListener('click', function(e) {
        e.preventDefault();
        fetch(`/api/showcase/${course.id}/analytics/checkout`, { method: 'POST' })
          .then(response => response.json())
          .then(data => {
              console.log('Showcase conversion updated:', data);
              window.open(newButton.href, '_blank');
          })
          .catch(err => {
              console.error('Error updating conversion:', err);
              window.open(newButton.href, '_blank');
          });
    });
    
    // Reinicializar ícones Lucide para o botão
    lucide.createIcons();
}

// Função para configurar o vídeo do showcase com Vidstack
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
    
    // Limpar listeners anteriores
    const newButton = purchaseButton.cloneNode(true);
    purchaseButton.parentNode.replaceChild(newButton, purchaseButton);
    
    // Configurar o botão de compra
    newButton.href = course.button_link || '#';
    newButton.innerHTML = `
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
    
    // Adicionar evento no botão
    newButton.addEventListener('click', function(e) {
        e.preventDefault();
        fetch(`/api/showcase/${course.id}/analytics/checkout`, { method: 'POST' })
          .then(response => response.json())
          .then(data => {
              console.log('Showcase conversion updated:', data);
              window.open(newButton.href, '_blank');
          })
          .catch(err => {
              console.error('Error updating conversion:', err);
              window.open(newButton.href, '_blank');
          });
    });
    
    // Usar a biblioteca Vidstack para o player
    import('https://cdn.vidstack.io/player').then(({ PlyrLayout, VidstackPlayer }) => {
        // Função para obter o ID do vídeo do YouTube
        function getYouTubeVideoId(url) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        }
        
        const videoUrl = course.video_url;
        const videoId = getYouTubeVideoId(videoUrl);
        
        // Player sempre sem controles para o showcase
        const layout = new PlyrLayout({ controls: [] });
        
        VidstackPlayer.create({
            target: '#showcaseVideoTarget',
            title: course.name,
            src: videoUrl,
            poster: videoId ? `https://i3.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '',
            layout: layout,
            playsinline: true  // Força reprodução inline em dispositivos móveis
        }).then(player => {
            // Se tiver delay no botão, configurar o evento para mostrar após o tempo especificado
            if (course.button_delay > 0) {
                let unsubscribe;
                
                function checkTime({ currentTime }) {
                    if (currentTime >= course.button_delay) {
                        purchaseButtonContainer.style.display = 'block';
                        purchaseButtonContainer.classList.add('cta-button-animation');
                        if (unsubscribe) {
                            unsubscribe();
                        }
                    }
                }
                
                unsubscribe = player.subscribe(checkTime);
            }
        });
    }).catch(err => {
        console.error('Erro ao carregar o player Vidstack:', err);
        // Fallback para mostrar apenas um placeholder com link
        mediaContainer.innerHTML = `
            <div class="bg-gray-900 rounded-lg p-6 text-center">
                <i data-lucide="video-off" class="h-16 w-16 mx-auto mb-4 text-gray-600"></i>
                <p class="text-gray-300 mb-2">Não foi possível carregar o vídeo</p>
                <a href="${course.video_url}" target="_blank" class="text-primary hover:underline">Assistir no site original</a>
            </div>
        `;
        
        // Mostrar o botão de compra
        purchaseButtonContainer.style.display = 'block';
        
        // Reinicializar ícones
        lucide.createIcons();
    });
}

// Função para configurar o botão de compra para uma imagem
function setupShowcasePurchaseButton(course) {
    const purchaseButtonContainer = document.getElementById('purchaseButtonContainer');
    const purchaseButton = document.getElementById('purchaseButton');
    
    // Limpar listeners anteriores
    const newButton = purchaseButton.cloneNode(true);
    purchaseButton.parentNode.replaceChild(newButton, purchaseButton);
    
    // Configurar o botão de compra
    newButton.href = course.button_link || '#';
    newButton.innerHTML = `
        <span class="purchase-shimmer"></span>
        <i data-lucide="unlock" class="h-6 w-6 mr-3 text-white"></i>
        <span class="text-xl font-bold text-white">${course.button_text || 'Desbloquear'}</span>
    `;
    
    // Adicionar evento no botão
    newButton.addEventListener('click', function(e) {
        e.preventDefault();
        fetch(`/api/showcase/${course.id}/analytics/checkout`, { method: 'POST' })
          .then(response => response.json())
          .then(data => {
              console.log('Showcase conversion updated:', data);
              window.open(newButton.href, '_blank');
          })
          .catch(err => {
              console.error('Error updating conversion:', err);
              window.open(newButton.href, '_blank');
          });
    });
    
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
    
    // Reinicializar ícones Lucide para o botão
    lucide.createIcons();
}

// Inicializa a página
window.onload = function() {
    loadAllStudentCourses();
    loadSupportEmail();
    loadPlatformName();
    initNavScrollEffect();
};

// Função para carregar o email de suporte
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

// Função para carregar o platform_name e atualizar o footer
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