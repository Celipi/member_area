// Garantir que o DOM esteja carregado antes de executar qualquer código
document.addEventListener('DOMContentLoaded', function() {
    // Obter o ID do curso da URL em vez de depender de template rendering
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = parseInt(urlParams.get('course_id')) || window.courseId || 0;
    
    // Verificar se temos um course ID válido
    if (!courseId) {
        console.error('Course ID não encontrado, verifique a URL ou configuração da página');
        return;
    }

    console.log('Course ID carregado:', courseId);
    
    let courseData = {
        id: courseId,
        name: "Carregando...",
        modules: []
    };

    const moduleModal = document.getElementById("moduleModal");
    const lessonModal = document.getElementById("lessonModal");
    const addModuleBtn = document.getElementById("addModuleBtn");
    const addCoverBtn = document.getElementById("addCoverBtn");
    const previewBtn = document.getElementById("previewBtn");
    const coverInput = document.getElementById("coverInput");
    const spans = document.getElementsByClassName("close");

    // Verificar se todos os elementos foram encontrados
    if (!moduleModal || !lessonModal || !addModuleBtn || !addCoverBtn || !previewBtn || !coverInput) {
        console.error('Elementos HTML necessários não encontrados');
        return;
    }

    // Configurar eventos de click
    addModuleBtn.addEventListener('click', function() {
        console.log("Botão Adicionar Módulo clicado");
        openModuleModal();
    });
    
    addCoverBtn.addEventListener('click', function() {
        console.log("Botão Adicionar Cover clicado");
        document.getElementById('coverModal').style.display = "block";
    });
    
    previewBtn.addEventListener('click', function() {
        console.log("Botão Pré-visualizar clicado");
        previewCourse();
    });

    // Fechar modais quando clicar no X
    for (let span of spans) {
        span.onclick = function() {
            moduleModal.style.display = "none";
            lessonModal.style.display = "none";
            // Limpar input de imagem do módulo
            const moduleImage = document.getElementById('moduleImage');
            if(moduleImage) moduleImage.value = "";
            const moduleImagePreview = document.getElementById('moduleImagePreview');
            if(moduleImagePreview) {
                moduleImagePreview.innerHTML = "";
                moduleImagePreview.style.display = "none";
            }
            // Limpar input de arquivos da aula
            const lessonDocuments = document.getElementById('lessonDocuments');
            if(lessonDocuments) lessonDocuments.value = "";
            const lessonDocumentsName = document.getElementById('lessonDocumentsName');
            if(lessonDocumentsName) lessonDocumentsName.textContent = "Nenhum arquivo selecionado";
            const selectedFilesCount = document.getElementById('selectedFilesCount');
            if(selectedFilesCount) selectedFilesCount.textContent = "";
            // Resetar formulários
            document.getElementById('moduleForm').reset();
            document.getElementById('lessonForm').reset();
        }
    }

    // Fechar modais ao clicar fora deles
    window.onclick = function(event) {
        if (event.target == moduleModal || event.target == lessonModal) {
            moduleModal.style.display = "none";
            lessonModal.style.display = "none";
            // Limpar input de imagem do módulo
            const moduleImage = document.getElementById('moduleImage');
            if(moduleImage) moduleImage.value = "";
            const moduleImagePreview = document.getElementById('moduleImagePreview');
            if(moduleImagePreview) {
                moduleImagePreview.innerHTML = "";
                moduleImagePreview.style.display = "none";
            }
            // Limpar input de arquivos da aula
            const lessonDocuments = document.getElementById('lessonDocuments');
            if(lessonDocuments) lessonDocuments.value = "";
            const lessonDocumentsName = document.getElementById('lessonDocumentsName');
            if(lessonDocumentsName) lessonDocumentsName.textContent = "Nenhum arquivo selecionado";
            const selectedFilesCount = document.getElementById('selectedFilesCount');
            if(selectedFilesCount) selectedFilesCount.textContent = "";
            // Resetar formulários
            document.getElementById('moduleForm').reset();
            document.getElementById('lessonForm').reset();
        }
    }

    // Fechar modal Cover via botão fechar (X)
    Array.from(document.querySelectorAll('#coverModal .close')).forEach(function(btn){
        btn.addEventListener('click', function(){
            document.getElementById('coverModal').style.display = "none";
            resetCoverModal();
        });
    });
    
    // Pré-visualizar imagem selecionada no modal de Cover
    const coverModalInput = document.getElementById('coverModalInput');
    const coverModalPreview = document.getElementById('coverModalPreview');
    const coverModalInputMobile = document.getElementById('coverModalInputMobile');
    const coverModalPreviewMobile = document.getElementById('coverModalPreviewMobile');
    if (coverModalInput && coverModalPreview) {
        coverModalInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    coverModalPreview.innerHTML = `<img src="${e.target.result}" alt="Pré-visualização do Cover Desktop" class="max-w-full rounded-md shadow-sm mx-auto">`;
                    coverModalPreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                coverModalPreview.innerHTML = `<p class="text-red-600 bg-red-50 p-2 rounded-md">Arquivo selecionado não é uma imagem</p>`;
                coverModalPreview.style.display = 'block';
            }
        });
    }
    if (coverModalInputMobile && coverModalPreviewMobile) {
        coverModalInputMobile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    coverModalPreviewMobile.innerHTML = `<img src="${e.target.result}" alt="Pré-visualização do Cover Mobile" class="max-w-full rounded-md shadow-sm mx-auto">`;
                    coverModalPreviewMobile.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                coverModalPreviewMobile.innerHTML = `<p class="text-red-600 bg-red-50 p-2 rounded-md">Arquivo selecionado não é uma imagem</p>`;
                coverModalPreviewMobile.style.display = 'block';
            }
        });
    }
    
    // Salvar Cover: enviar o arquivo via fetch
    document.getElementById('saveCoverBtn').addEventListener('click', function() {
        const fileDesktop = coverModalInput.files[0];
        const fileMobile = coverModalInputMobile.files[0];
        if (!fileDesktop && !fileMobile) {
            alert("Selecione ao menos uma imagem antes de salvar.");
            return;
        }
        var formData = new FormData();
        if (fileDesktop) formData.append('file', fileDesktop);
        if (fileMobile) formData.append('file_mobile', fileMobile);
        formData.append('course_id', courseId);
        fetch('/admin/upload_cover', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success){
                alert("Cover salvo com sucesso!");
                document.getElementById('coverModal').style.display = "none";
                resetCoverModal();
                fetchCourseData();
            } else {
                alert("Erro ao salvar cover.");
            }
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar cover.");
        });
    });
    
    // Excluir Cover: enviar requisição DELETE
    document.getElementById('deleteCoverBtn').addEventListener('click', function() {
        if(confirm("Tem certeza que deseja excluir o cover?")) {
            fetch(`/admin/cover?course_id=${courseId}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if(data.success){
                    alert("Cover excluído com sucesso!");
                    document.getElementById('coverModal').style.display = "none";
                    resetCoverModal();
                    fetchCourseData();
                } else {
                    alert("Erro ao excluir cover.");
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao excluir cover.");
            });
        }
    });
    
    function resetCoverModal() {
        if (coverModalInput) coverModalInput.value = "";
        if (coverModalPreview) {
            coverModalPreview.innerHTML = "";
            coverModalPreview.style.display = "none";
        }
        if (coverModalInputMobile) coverModalInputMobile.value = "";
        if (coverModalPreviewMobile) {
            coverModalPreviewMobile.innerHTML = "";
            coverModalPreviewMobile.style.display = "none";
        }
    }

    // Inicializa o editor Quill para a descrição da aula
    var quill;
    if (document.getElementById('lessonDescriptionEditor')) {
        quill = new Quill('#lessonDescriptionEditor', {
            theme: 'snow',
            placeholder: 'Digite a descrição da aula...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike',{ 'color': [] },{ 'background': [] },'link','clean']
                ]
            }
        });
    }

    // Eventos do formulário do módulo
    document.getElementById('moduleForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const form = new FormData(this);
        const moduleId = document.getElementById('moduleId').value;

        const url = moduleId ? `/admin/module/${moduleId}` : `/admin/course/${courseId}/module`;
        const method = moduleId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            body: form,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                moduleModal.style.display = "none";
                fetchCourseData();
                this.reset();
                // Limpar input de imagem do módulo e sua pré-visualização
                const moduleImage = document.getElementById('moduleImage');
                if(moduleImage) moduleImage.value = "";
                const moduleImagePreview = document.getElementById('moduleImagePreview');
                if(moduleImagePreview) {
                    moduleImagePreview.innerHTML = "";
                    moduleImagePreview.style.display = "none";
                }
            } else {
                alert('Erro ao salvar módulo');
            }
        });
    });

    // Eventos do formulário da aula
    document.getElementById('lessonForm').addEventListener('submit', function(e) {
        e.preventDefault();
        // Copiar o conteúdo formatado do Quill para o input oculto
        document.getElementById('lessonDescription').value = quill.root.innerHTML;
        
        const form = new FormData(this);
        const lessonId = document.getElementById('lessonId').value;
        const moduleId = document.getElementById('lessonModuleId').value;
        const videoType = document.getElementById('lessonVideoType').value;

        // Se for VTurb, pegar o código do textarea específico
        if (videoType === 'vturb') {
            const vturbCode = document.getElementById('vturbCode').value;
            form.set('video_url', vturbCode);
            form.set('video_type', 'vturb');
        }

        const url = lessonId ? `/admin/lesson/${lessonId}` : `/admin/module/${moduleId}/lesson`;
        const method = lessonId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            body: form,
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Resposta da rede não foi ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                lessonModal.style.display = "none";
                fetchCourseData();
                resetForm();
            } else {
                alert('Erro ao salvar aula: ' + (data.message || 'Erro desconhecido'));
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            alert('Erro ao salvar aula: ' + error.message);
        });
    });

    // Evento de upload do cover
    coverInput.addEventListener('change', function(){
        var file = this.files[0];
        if(file) {
            var formData = new FormData();
            formData.append('file', file);
            formData.append('course_id', courseId);
            fetch('/admin/upload_cover', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if(data.success){
                    alert("Cover enviado com sucesso!");
                } else {
                    alert("Erro ao enviar cover.");
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao enviar cover.");
            });
        }
    });

    // Configuração da prévia de imagem do módulo
    const moduleImage = document.getElementById('moduleImage');
    const moduleImagePreview = document.getElementById('moduleImagePreview');
    
    if (moduleImage && moduleImagePreview) {
        moduleImage.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        moduleImagePreview.innerHTML = `<img src="${e.target.result}" alt="Pré-visualização da imagem do módulo" class="max-h-40 mx-auto rounded">`;
                        moduleImagePreview.style.display = 'block';
                    }
                    reader.readAsDataURL(file);
                } else {
                    moduleImagePreview.innerHTML = `<p class="text-red-600">Arquivo selecionado não é uma imagem</p>`;
                    moduleImagePreview.style.display = 'block';
                }
            } else {
                moduleImagePreview.style.display = 'none';
            }
        });
    }

    // Configuração do toggle de CTA
    const extraOptionsToggle = document.getElementById('extraOptionsToggle');
    const extraOptions = document.getElementById('extraOptions');
    const hasButtonInput = document.getElementById('hasButton');
    
    if (extraOptionsToggle && extraOptions && hasButtonInput) {
        extraOptionsToggle.addEventListener('change', function() {
            extraOptions.style.display = this.checked ? 'block' : 'none';
            hasButtonInput.value = this.checked.toString();
        });
    }

    // Função para buscar os dados do curso
    function fetchCourseData() {
        console.log("Buscando dados do curso...");
        fetch(`/admin/course/${courseId}/details`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Dados do curso recebidos:", data);
                courseData = data;
                renderCourse();
            })
            .catch(error => {
                console.error("Erro ao buscar dados do curso:", error);
                document.getElementById('courseName').textContent = "Erro ao carregar o curso";
            });
    }

    // Restante das funções
    function resetForm() {
        const lessonForm = document.getElementById('lessonForm');
        const extraOptionsToggle = document.getElementById('extraOptionsToggle');
        const extraOptions = document.getElementById('extraOptions');
        const hasButtonInput = document.getElementById('hasButton');

        lessonForm.reset();
        document.getElementById('lessonId').value = ''; // Limpa o ID da aula
        document.getElementById('lessonVideoType').value = 'youtube';
        extraOptionsToggle.checked = false;
        extraOptions.style.display = 'none';
        hasButtonInput.value = 'false';
        document.getElementById('buttonText').value = '';
        document.getElementById('buttonLink').value = '';
        document.getElementById('appearanceTime').value = '';
        // Limpar input de arquivos da aula e seus elementos de exibição
        const lessonDocuments = document.getElementById('lessonDocuments');
        if(lessonDocuments) lessonDocuments.value = "";
        const lessonDocumentsName = document.getElementById('lessonDocumentsName');
        if(lessonDocumentsName) lessonDocumentsName.textContent = "Nenhum arquivo selecionado";
        const selectedFilesCount = document.getElementById('selectedFilesCount');
        if(selectedFilesCount) selectedFilesCount.textContent = "";
        // Reinicializa o editor Quill
        if (quill) {
            quill.root.innerHTML = '';
        }
    }

    function openModuleModal(moduleId = null) {
        const form = document.getElementById('moduleForm');
        const title = document.getElementById('moduleModalTitle');
        const preview = document.getElementById('moduleImagePreview');
        
        if (moduleId) {
            const module = courseData.modules.find(m => m.id === moduleId);
            if (!module) {
                console.error('Módulo não encontrado:', moduleId);
                return;
            }

            title.textContent = 'Editar Módulo';
            document.getElementById('moduleId').value = moduleId;
            document.getElementById('moduleName').value = module.name || '';
            
            // Exibir imagem salva, se existir
            if (module.image) {
                preview.innerHTML = `<img src="/static/uploads/${module.image}" alt="Imagem do módulo" class="max-h-40 mx-auto rounded">`;
                preview.style.display = 'block';
            } else {
                preview.innerHTML = '';
                preview.style.display = 'none';
            }
        } else {
            title.textContent = 'Adicionar Novo Módulo';
            form.reset();
            document.getElementById('moduleId').value = '';
            
            // Limpar a pré-visualização da imagem
            preview.style.display = 'none';
            preview.innerHTML = '';
        }

        // Garantir que o modal seja exibido
        moduleModal.style.display = "block";
        console.log("Modal de módulo aberto:", moduleModal.style.display);
    }

    function openLessonModal(moduleId, lessonId = null) {
        const form = document.getElementById('lessonForm');
        const title = document.getElementById('lessonModalTitle');
        const extraOptionsToggle = document.getElementById('extraOptionsToggle');
        const extraOptions = document.getElementById('extraOptions');
        const hasButtonInput = document.getElementById('hasButton');
        const modal = document.getElementById('lessonModal');
        const videoTypeSelect = document.getElementById('lessonVideoType');
        const youtubeUrlGroup = document.getElementById('youtubeUrlGroup');
        const vturbCodeGroup = document.getElementById('vturbCodeGroup');
        
        // Atualizar CTA conforme a seleção de vídeo
        videoTypeSelect.addEventListener('change', function() {
            const ctaSection = document.getElementById('ctaSection');
            if (this.value === 'vturb') {
                youtubeUrlGroup.style.display = 'none';
                vturbCodeGroup.style.display = 'block';
                if (ctaSection) ctaSection.style.display = 'none';
            } else {
                youtubeUrlGroup.style.display = 'block';
                vturbCodeGroup.style.display = 'none';
                if (ctaSection) ctaSection.style.display = 'block';
            }
        });
        
        if (!moduleId) {
            console.error('ID do módulo não fornecido');
            return;
        }
        
        document.getElementById('lessonModuleId').value = moduleId;
        document.getElementById('lessonVideoType').value = 'youtube'; // Definindo YouTube como valor padrão

        if (lessonId) {
            const module = courseData.modules.find(m => m.id === moduleId);
            if (module) {
                const lesson = module.lessons.find(l => l.id === lessonId);
                if (lesson) {
                    console.log("Lesson encontrada:", lesson);
                    title.textContent = 'Editar Aula';
                    document.getElementById('lessonId').value = lessonId;
                    document.getElementById('lessonTitle').value = lesson.title || '';
                    if (quill) {
                        quill.root.innerHTML = lesson.description || '';
                    }
                    document.getElementById('lessonDescription').value = lesson.description || '';
                    
                    // Configurar tipo de vídeo e campos relacionados
                    const videoType = lesson.video_type || 'youtube';
                    videoTypeSelect.value = videoType;
                    
                    if (videoType === 'vturb') {
                        youtubeUrlGroup.style.display = 'none';
                        vturbCodeGroup.style.display = 'block';
                        document.getElementById('vturbCode').value = lesson.video_url || '';
                    } else {
                        youtubeUrlGroup.style.display = 'block';
                        vturbCodeGroup.style.display = 'none';
                        document.getElementById('lessonVideoUrl').value = lesson.video_url || '';
                    }

                    // Configurar CTA conforme os valores da aula
                    const hasCTA = (lesson.has_button === true || lesson.has_button === 'true');
                    extraOptionsToggle.checked = hasCTA;
                    hasButtonInput.value = hasCTA.toString();
                    extraOptions.style.display = hasCTA ? 'block' : 'none';
                    document.getElementById('buttonText').value = hasCTA ? (lesson.button_text || '') : '';
                    document.getElementById('buttonLink').value = hasCTA ? (lesson.button_link || '') : '';
                    document.getElementById('appearanceTime').value = hasCTA ? (lesson.button_delay || '') : '';
                    
                    // Carregar arquivos existentes
                    fetch(`/admin/lesson/${lessonId}/files`)
                        .then(response => response.json())
                        .then(files => {
                            const filesList = document.getElementById('existingFilesList');
                            filesList.innerHTML = '';
                            
                            files.forEach(file => {
                                const fileItem = document.createElement('div');
                                fileItem.className = 'flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md';
                                fileItem.setAttribute('data-file-id', file.id);
                                fileItem.innerHTML = `
                                    <span class="text-sm text-gray-700">${file.filename}</span>
                                    <button type="button" onclick="removeFile(${lessonId}, ${file.id})" 
                                            class="text-red-600 hover:text-red-800">
                                        <i data-lucide="trash-2" class="h-4 w-4"></i>
                                    </button>
                                `;
                                filesList.appendChild(fileItem);
                            });
                            
                            // Reinicializar ícones Lucide
                            lucide.createIcons();
                        })
                        .catch(error => {
                            console.error('Erro ao carregar arquivos:', error);
                        });

                    const uploadSection = document.querySelector('#lessonModal .upload-section');
                    const existingFilesSection = document.querySelector('#lessonModal .existing-files-section');
                    if (uploadSection) uploadSection.style.display = 'none';
                    if (existingFilesSection) existingFilesSection.style.display = 'block';
                } else {
                    console.error('Aula não encontrada');
                    return;
                }
            } else {
                console.error('Módulo não encontrado');
                return;
            }
        } else {
            title.textContent = 'Adicionar Nova Aula';
            resetForm();
            extraOptionsToggle.checked = false;
            hasButtonInput.value = 'false';
            extraOptions.style.display = 'none';
            
            // Reset video fields
            videoTypeSelect.value = 'youtube';
            youtubeUrlGroup.style.display = 'block';
            vturbCodeGroup.style.display = 'none';
            document.getElementById('lessonVideoUrl').value = '';
            document.getElementById('vturbCode').value = '';
            
            document.getElementById('existingFilesList').innerHTML = '';

            const uploadSection = document.querySelector('#lessonModal .upload-section');
            const existingFilesSection = document.querySelector('#lessonModal .existing-files-section');
            if (uploadSection) uploadSection.style.display = 'block';
            if (existingFilesSection) existingFilesSection.style.display = 'none';
            if (quill) {
                quill.root.innerHTML = '';
            }
        }
        
        // Atualizar contador de arquivos selecionados
        const lessonDocuments = document.getElementById('lessonDocuments');
        if (lessonDocuments) {
            lessonDocuments.addEventListener('change', function() {
                const count = this.files.length;
                const countText = count > 0 ? `${count} arquivo${count > 1 ? 's' : ''} selecionado${count > 1 ? 's' : ''}` : '';
                const selectedFilesCount = document.getElementById('selectedFilesCount');
                if (selectedFilesCount) {
                    selectedFilesCount.textContent = countText;
                }
            });
        }

        // Mostrar o modal
        console.log("Exibindo modal de aula...");
        if (modal) {
            modal.style.display = "block";
            console.log("Modal display style:", modal.style.display);
        } else {
            console.error("Modal element não encontrado!");
        }
    }

    function removeFile(lessonId, fileId) {
        if (confirm('Tem certeza que deseja remover este arquivo?')) {
            fetch(`/admin/lesson/${lessonId}/file/${fileId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Atualizar a lista de arquivos
                    const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
                    if (fileElement) {
                        fileElement.remove();
                    }
                    fetchCourseData(); // Atualizar dados do curso
                } else {
                    alert('Erro ao remover arquivo');
                }
            });
        }
    }
    // Expor a função removeFile globalmente para ser chamada pelo onclick inline
    window.removeFile = removeFile;

    function renderCourse() {
        console.log("Renderizando curso:", courseData);
        
        // Ordenar módulos e aulas por order (ASC)
        if (courseData.modules && Array.isArray(courseData.modules)) {
            courseData.modules.sort((a, b) => a.order - b.order);
            courseData.modules.forEach(module => {
                if (module.lessons && Array.isArray(module.lessons)) {
                    module.lessons.sort((a, b) => a.order - b.order);
                }
            });
        }

        // Atualizar o nome do curso
        const courseNameElement = document.getElementById('courseName');
        if (courseNameElement) {
            courseNameElement.textContent = courseData.name || 'Nome do Curso Não Disponível';
        }

        // Obter a lista de módulos e limpar
        const moduleList = document.getElementById('moduleList');
        if (!moduleList) {
            console.error('Elemento moduleList não encontrado');
            return;
        }
        moduleList.innerHTML = '';

        // Obter os templates
        const moduleTemplate = document.getElementById('moduleTemplate');
        const lessonTemplate = document.getElementById('lessonTemplate');
        if (!moduleTemplate || !lessonTemplate) {
            console.error('Templates não encontrados');
            return;
        }

        // Verificar se há módulos para renderizar
        if (!courseData.modules || courseData.modules.length === 0) {
            console.log('Nenhum módulo para exibir');
            moduleList.innerHTML = '<div class="bg-gray-50 p-4 text-center rounded-lg border border-gray-200"><p class="text-gray-500">Nenhum módulo criado ainda.</p></div>';
            return;
        }

        // Renderizar cada módulo
        courseData.modules.forEach((module) => {
            try {
                // Clonar o template do módulo
                const moduleElement = document.importNode(moduleTemplate.content, true).firstElementChild;
                if (!moduleElement) {
                    console.error('Elemento do módulo não pôde ser clonado');
                    return;
                }
                
                // Adicionar atributo com o ID do módulo
                moduleElement.setAttribute('data-module-id', module.id);

                // Preencher os dados do módulo
                const moduleTitle = moduleElement.querySelector('h3');
                if (moduleTitle) {
                    moduleTitle.textContent = module.name || 'Sem nome';
                }
                
                // Obter os botões do módulo
                const editModuleBtn = moduleElement.querySelector('.edit-module');
                const deleteModuleBtn = moduleElement.querySelector('.delete-module');
                const addLessonBtn = moduleElement.querySelector('.add-lesson');
                
                // Configurar os botões do módulo
                if (editModuleBtn) {
                    editModuleBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        editModule(module.id);
                    });
                }
                
                if (deleteModuleBtn) {
                    deleteModuleBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        deleteModule(module.id);
                    });
                }
                
                if (addLessonBtn) {
                    addLessonBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        addLesson(module.id);
                    });
                }
                
                // Adicionar o módulo à lista
                moduleList.appendChild(moduleElement);
                
                // Obter a lista de aulas deste módulo
                const lessonList = moduleElement.querySelector('.lesson-list');
                if (!lessonList) {
                    console.error('Lista de aulas não encontrada no elemento do módulo');
                    return;
                }
                
                // Adicionar aulas ao módulo
                if (module.lessons && module.lessons.length > 0) {
                    module.lessons.forEach((lesson) => {
                        try {
                            // Clonar o template de aula
                            const lessonElement = document.importNode(lessonTemplate.content, true).firstElementChild;
                            if (!lessonElement) {
                                console.error('Elemento da aula não pôde ser clonado');
                                return;
                            }
                            
                            // Adicionar atributo com o ID da aula
                            lessonElement.setAttribute('data-lesson-id', lesson.id);
                            
                            // Preencher os dados da aula
                            const lessonTitle = lessonElement.querySelector('.lesson-title');
                            if (lessonTitle) {
                                lessonTitle.textContent = lesson.title || 'Sem título';
                            }
                            
                            // Obter os botões da aula
                            const editLessonBtn = lessonElement.querySelector('.edit-lesson');
                            const deleteLessonBtn = lessonElement.querySelector('.delete-lesson');
                            
                            // Configurar os botões da aula
                            if (editLessonBtn) {
                                editLessonBtn.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    editLesson(module.id, lesson.id);
                                });
                            }
                            
                            if (deleteLessonBtn) {
                                deleteLessonBtn.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    deleteLesson(module.id, lesson.id);
                                });
                            }
                            
                            // Adicionar a aula à lista
                            lessonList.appendChild(lessonElement);
                        } catch (error) {
                            console.error('Erro ao renderizar aula:', error);
                        }
                    });
                } else {
                    lessonList.innerHTML = '<div class="text-gray-500 text-sm text-center py-2">Nenhuma aula neste módulo</div>';
                }
                
                // Inicializar Sortable para a lista de aulas se a biblioteca estiver disponível
                if (typeof Sortable !== 'undefined') {
                    new Sortable(lessonList, {
                        animation: 150,
                        handle: '.drag-handle',
                        onEnd: function(evt) {
                            reorderLessons(module.id);
                        }
                    });
                } else {
                    console.warn('Biblioteca Sortable não encontrada');
                }
            } catch (error) {
                console.error('Erro ao renderizar módulo:', error);
            }
        });
        
        // Inicializar Sortable para a lista de módulos se a biblioteca estiver disponível
        if (typeof Sortable !== 'undefined') {
            new Sortable(moduleList, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: function(evt) {
                    reorderModules();
                }
            });
        } else {
            console.warn('Biblioteca Sortable não encontrada');
        }
        
        // Inicializa os ícones Lucide para os elementos recém-adicionados
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        } else {
            console.warn('Biblioteca Lucide não encontrada ou createIcons não é uma função');
        }
    }

    function editModule(moduleId) {
        console.log("Editando módulo:", moduleId);
        openModuleModal(moduleId);
    }

    function deleteModule(moduleId) {
        console.log("Excluindo módulo:", moduleId);
        if (confirm("Tem certeza que deseja excluir este módulo?")) {
            fetch(`/admin/module/${moduleId}`, {
                method: 'DELETE',
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    fetchCourseData();
                } else {
                    alert('Erro ao excluir módulo');
                }
            });
        }
    }

    function addLesson(moduleId) {
        console.log("Adicionando aula ao módulo:", moduleId);
        openLessonModal(moduleId);
    }

    function editLesson(moduleId, lessonId) {
        console.log("Editando aula:", lessonId, "do módulo:", moduleId);
        if (!moduleId || !lessonId) {
            console.error('IDs inválidos:', moduleId, lessonId);
            return;
        }
        openLessonModal(moduleId, lessonId);
    }

    function deleteLesson(moduleId, lessonId) {
        console.log("Excluindo aula:", lessonId);
        if (confirm("Tem certeza que deseja excluir esta aula?")) {
            fetch(`/admin/lesson/${lessonId}`, {
                method: 'DELETE',
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    fetchCourseData();
                } else {
                    alert('Erro ao excluir aula');
                }
            });
        }
    }

    function reorderModules() {
        const moduleElements = document.querySelectorAll('#moduleList > div.module');
        const newOrder = Array.from(moduleElements).map(el => parseInt(el.getAttribute('data-module-id')));
        
        if (newOrder.length > 0) {
            console.log("Reordenando módulos, nova ordem:", newOrder);
            
            fetch(`/admin/reorder_modules`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ new_order: newOrder }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    fetchCourseData();
                } else {
                    alert('Erro ao reordenar módulos');
                }
            })
            .catch(error => {
                console.error("Erro ao reordenar módulos:", error);
                alert('Ocorreu um erro ao reordenar os módulos');
            });
        }
    }

    function reorderLessons(moduleId) {
        const moduleElement = document.querySelector(`#moduleList > div.module[data-module-id="${moduleId}"]`);
        if (!moduleElement) {
            console.error('Elemento de módulo não encontrado para reordenação');
            return;
        }
        
        const lessonElements = moduleElement.querySelectorAll('.lesson-list > div.lesson');
        const newOrder = Array.from(lessonElements).map(el => parseInt(el.getAttribute('data-lesson-id')));
        
        if (newOrder.length > 0) {
            console.log(`Reordenando aulas para o módulo ${moduleId}, nova ordem:`, newOrder);
            
            fetch(`/admin/reorder_lessons`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ new_order: newOrder }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    fetchCourseData();
                } else {
                    alert('Erro ao reordenar aulas');
                }
            })
            .catch(error => {
                console.error("Erro ao reordenar aulas:", error);
                alert('Ocorreu um erro ao reordenar as aulas');
            });
        }
    }

    function previewCourse() {
        console.log("Pré-visualizando curso:", courseId);
        window.open('/preview_course/' + courseId, '_blank');
    }

    function getEventListeners(element) {
        return null;
    }

    // Iniciar o carregamento dos dados do curso
    console.log("Iniciando carregamento dos dados do curso...");
    fetchCourseData();
});