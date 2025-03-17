// JavaScript for showcase management

document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    const showcaseContainer = document.getElementById('showcaseContainer');
    const modal = document.getElementById('showcaseModal');
    const metricsModal = document.getElementById('metricsModal');
    const form = document.getElementById('showcaseForm');
    const hasVideoCheckbox = document.getElementById('hasVideo');
    const videoInputContainer = document.getElementById('videoInputContainer');
    const addItemButton = document.getElementById('addShowcaseItemBtn');
    const showMetricsButton = document.getElementById('showMetricsBtn'); // New button
    const emptyAddItemButton = document.getElementById('emptyAddItem');
    const closeButtons = document.querySelectorAll('.close');
    const closeMetricsButtons = document.querySelectorAll('.close-metrics'); // New buttons
    const searchInput = document.getElementById('searchShowcase');
    const filterSelect = document.getElementById('showcaseFilter');
    const sortSelect = document.getElementById('showcaseSort');
    const emptyState = document.getElementById('emptyState');
    const buttonDelayInput = document.getElementById('buttonDelay');
    const applyMetricsFilterButton = document.getElementById('applyMetricsFilter');
    
    let showcaseItems = [];
    let metricsChart = null; // Will hold our Chart.js instance

    // Ao carregar, se não estiver habilitado vídeo, desabilitar delay
    buttonDelayInput.disabled = !hasVideoCheckbox.checked;

    // Atualiza o estado do input do delay quando o checkbox de vídeo é alterado
    hasVideoCheckbox.addEventListener('change', function() {
        document.getElementById('videoInputContainer').classList.toggle('hidden', !this.checked);
        if (this.checked) {
            buttonDelayInput.disabled = false;
        } else {
            buttonDelayInput.value = 0;
            buttonDelayInput.disabled = true;
        }
    });

    // Initialize the date inputs with current month and configure constraints
    const initializeDateInputs = () => {
        // Get today's date in São Paulo timezone (UTC-3)
        const today = new Date();
        const offset = -3; // São Paulo timezone offset in hours
        const saoPauloTime = new Date(today.getTime() + offset * 60 * 60 * 1000);
        const todayInSaoPaulo = new Date(saoPauloTime.getFullYear(), saoPauloTime.getMonth(), saoPauloTime.getDate());
        
        // Format today as YYYY-MM-DD for input max attribute
        const maxDate = todayInSaoPaulo.toISOString().split('T')[0];
        
        // Default start date to first day of current month
        const startDate = new Date(todayInSaoPaulo.getFullYear(), todayInSaoPaulo.getMonth(), 1);
        // Default end date to today
        const endDate = todayInSaoPaulo;
        
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        // Set max attribute to limit selection to today
        startDateInput.setAttribute('max', maxDate);
        endDateInput.setAttribute('max', maxDate);
        
        // Set default values
        startDateInput.valueAsDate = startDate;
        endDateInput.valueAsDate = endDate;
        
        // Add event listener to start date to update end date if needed
        startDateInput.addEventListener('change', function() {
            // If end date is before start date, set end date equal to start date
            if (endDateInput.value && this.value > endDateInput.value) {
                endDateInput.value = this.value;
            }
            
            // Set min attribute of end date to start date
            endDateInput.setAttribute('min', this.value);
        });
        
        // Initial setup: set min attribute of end date
        endDateInput.setAttribute('min', startDateInput.value);
    };

    // Populate showcase dropdown in metrics modal
    const populateShowcaseSelect = () => {
        const select = document.getElementById('metricsShowcaseSelect');
        select.innerHTML = '<option value="all">Todas as vitrines</option>';
        
        showcaseItems.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    };

    // Open metrics modal
    const openMetricsModal = () => {
        populateShowcaseSelect();
        initializeDateInputs(); // This now sets max dates and constraints
        loadMetricsData();
        metricsModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    // Close metrics modal
    const closeMetricsModal = () => {
        metricsModal.style.display = 'none';
        document.body.style.overflow = '';
    };

    // Fetch metrics data from server
    const loadMetricsData = async () => {
        try {
            const showcaseId = document.getElementById('metricsShowcaseSelect').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            // Create query params
            const params = new URLSearchParams();
            if (showcaseId !== 'all') params.append('showcase_id', showcaseId);
            params.append('start_date', startDate);
            params.append('end_date', endDate);
            
            const response = await fetch(`/api/showcase/analytics?${params.toString()}`);
            if (!response.ok) throw new Error('Erro ao carregar métricas');
            
            const data = await response.json();
            updateMetricsDisplay(data);
            renderMetricsChart(data);
        } catch (error) {
            console.error('Error loading metrics:', error);
            document.getElementById('metricsViews').textContent = '0';
            document.getElementById('metricsClicks').textContent = '0';
            document.getElementById('metricsConversion').textContent = '0%';
            showNoDataMessage(true);
        }
    };

    // Update metrics display
    const updateMetricsDisplay = (data) => {
        const totalViews = data.totalViews || 0;
        const totalClicks = data.totalClicks || 0;
        const conversionRate = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0';
        
        document.getElementById('metricsViews').textContent = totalViews;
        document.getElementById('metricsClicks').textContent = totalClicks;
        document.getElementById('metricsConversion').textContent = `${conversionRate}%`;
    };

    // Show no data message when applicable
    const showNoDataMessage = (show) => {
        const chartCanvas = document.getElementById('metricsChart');
        const noDataMessage = document.getElementById('noDataMessage');
        
        if (show) {
            chartCanvas.style.display = 'none';
            noDataMessage.classList.remove('hidden');
        } else {
            chartCanvas.style.display = 'block';
            noDataMessage.classList.add('hidden');
        }
    };

    // Render metrics chart
    const renderMetricsChart = (data) => {
        // If no daily data available, show "no data" message
        if (!data.dailyData || data.dailyData.length === 0) {
            showNoDataMessage(true);
            return;
        }
        
        showNoDataMessage(false);
        
        const ctx = document.getElementById('metricsChart').getContext('2d');
        
        // If chart already exists, destroy it before creating a new one
        if (metricsChart) {
            metricsChart.destroy();
        }
        
        const dates = data.dailyData.map(item => item.date);
        const views = data.dailyData.map(item => item.views);
        const clicks = data.dailyData.map(item => item.conversions);
        
        // Create gradient for area under the line
        const viewsGradient = ctx.createLinearGradient(0, 0, 0, 400);
        viewsGradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        viewsGradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
        
        const clicksGradient = ctx.createLinearGradient(0, 0, 0, 400);
        clicksGradient.addColorStop(0, 'rgba(139, 92, 246, 0.5)');
        clicksGradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
        
        metricsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Visualizações',
                        data: views,
                        borderColor: '#3B82F6',
                        backgroundColor: viewsGradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#3B82F6',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                    {
                        label: 'Cliques',
                        data: clicks,
                        borderColor: '#8B5CF6',
                        backgroundColor: clicksGradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#8B5CF6',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleFont: {
                            size: 13,
                        },
                        bodyFont: {
                            size: 12
                        },
                        padding: 12,
                        cornerRadius: 8,
                        usePointStyle: true,
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(156, 163, 175, 0.1)',
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round'
                    }
                }
            }
        });
    };

    // Initialize showcase data
    const initializeData = async () => {
        try {
            // Fetch showcase items
            const response = await fetch('/admin/api/showcase');
            if (!response.ok) throw new Error('Erro ao carregar dados');
            
            showcaseItems = await response.json();
            
            // Fetch all courses to get their names
            const coursesResponse = await fetch('/admin/all-courses');
            if (coursesResponse.ok) {
                const courses = await coursesResponse.json();
                // Create a map of course IDs to course names
                const courseMap = {};
                courses.forEach(course => {
                    courseMap[course.id] = course.name;
                });
                
                // Attach course names to showcase items
                showcaseItems.forEach(item => {
                    item.courseName = courseMap[item.course_id] || 'Curso não encontrado';
                });
            }
            
            // Update basic statistics
            document.getElementById('totalShowcaseItems').textContent = showcaseItems.length;
            
            // Fetch total analytics data for all time
            const analyticsResponse = await fetch('/api/showcase/analytics/total');
            if (analyticsResponse.ok) {
                const analyticsData = await analyticsResponse.json();
                
                // Update total views and conversions from analytics
                document.getElementById('totalViews').textContent = analyticsData.totalViews.toLocaleString();
                
                // Calculate conversion rate
                const totalViews = analyticsData.totalViews;
                const totalClicks = analyticsData.totalClicks;
                const conversionRate = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0';
                document.getElementById('totalConversions').textContent = `${conversionRate}%`;
            } else {
                // If analytics fetch fails, display zeros
                document.getElementById('totalViews').textContent = '0';
                document.getElementById('totalConversions').textContent = '0%';
            }
            
            renderShowcaseItems();
        } catch (error) {
            console.error('Error loading showcase items:', error);
            showError('Erro ao carregar itens da vitrine');
        }
    };

    // Filter and sort items
    const filterAndSortItems = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filterValue = filterSelect.value;
        const sortValue = sortSelect.value;

        let filteredItems = [...showcaseItems];

        // Apply filter
        if (filterValue !== 'all') {
            filteredItems = filteredItems.filter(item => item.status === filterValue);
        }

        // Apply search
        if (searchTerm) {
            filteredItems = filteredItems.filter(item => 
                item.name.toLowerCase().includes(searchTerm) || 
                item.description.toLowerCase().includes(searchTerm)
            );
        }

        // Apply sort
        switch (sortValue) {
            case 'newest':
                filteredItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'oldest':
                filteredItems.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                break;
            case 'priority':
                filteredItems.sort((a, b) => b.priority - a.priority);
                break;
        }

        return filteredItems;
    };

    // Render showcase items as table rows
    const renderShowcaseItems = () => {
        const filteredItems = filterAndSortItems();
        showcaseContainer.innerHTML = '';

        if (filteredItems.length === 0) {
            showcaseContainer.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        } else {
            emptyState.classList.add('hidden');
        }

        filteredItems.forEach(item => {
            const imagePath = item.image ? `/static/uploads/${item.image}` : '/static/fixed/default-course.jpg';
            
            // Create table row
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors';
            
            // Updated video indicator with a flex container for vertical alignment
            const videoIconHTML = item.has_video ?
               `<div class="flex items-center"><i data-lucide="video" class="h-5 w-5 text-blue-500"></i><span class="ml-1 text-xs text-gray-700">Com vídeo</span></div>` :
               `<div class="flex items-center"><i data-lucide="video-off" class="h-5 w-5 text-gray-400"></i><span class="ml-1 text-xs text-gray-700">Sem vídeo</span></div>`;
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-16 rounded overflow-hidden">
                            <img src="${imagePath}" alt="${item.name}" class="h-10 w-full object-cover">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${item.name}</div>
                            <div class="text-sm text-gray-500 line-clamp-2 max-w-xs">${item.description}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs">${item.courseName || 'Curso não encontrado'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${item.priority || 5}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex justify-center">${videoIconHTML}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex justify-center">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer status-toggle" data-id="${item.id}" ${item.status === 'active' ? 'checked' : ''}>
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex justify-end space-x-2">
                        <button class="edit-item p-2 rounded-full bg-gray-100 hover:bg-yellow-100 text-gray-600 hover:text-yellow-700 transition-all" data-id="${item.id}">
                            <i data-lucide="pencil" class="h-4 w-4"></i>
                        </button>
                        <button class="delete-item p-2 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 transition-all" data-id="${item.id}">
                            <i data-lucide="trash-2" class="h-4 w-4"></i>
                        </button>
                    </div>
                </td>
            `;
            
            showcaseContainer.appendChild(row);
        });
        
        lucide.createIcons();
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-item').forEach(button => {
            button.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-id'));
                openEditModal(id);
            });
        });
        
        document.querySelectorAll('.delete-item').forEach(button => {
            button.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-id'));
                deleteShowcaseItem(id);
            });
        });

        // Add event listeners for status toggles
        document.querySelectorAll('.status-toggle').forEach(toggle => {
            toggle.addEventListener('change', function() {
                const id = parseInt(this.getAttribute('data-id'));
                updateShowcaseItemStatus(id, this.checked ? 'active' : 'inactive');
            });
        });
    };

    // Função para mostrar alertas de erro mais informativos
    const showError = (message) => {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: message,
        });
    };

    // Função para mostrar alertas de sucesso
    const showSuccess = (message) => {
        Swal.fire({
            icon: 'success',
            title: 'Sucesso',
            text: message,
            timer: 2000,
            showConfirmButton: false
        });
    };

    // Update showcase item status
    const updateShowcaseItemStatus = async (id, status) => {
        try {
            const response = await fetch(`/admin/api/showcase/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                if (result.success) {
                    // Update the item in the local array
                    const index = showcaseItems.findIndex(item => item.id === id);
                    if (index !== -1) {
                        showcaseItems[index].status = status;
                    }
                    showSuccess(`Item ${status === 'active' ? 'ativado' : 'desativado'} com sucesso!`);
                }
            } else {
                // Reset the toggle to its previous state - do this first for immediate visual feedback
                const toggle = document.querySelector(`.status-toggle[data-id="${id}"]`);
                if (toggle) toggle.checked = status !== 'active'; // Reverses the toggle state
                
                // Se recebeu erro 409 (Conflict), mostra mensagem específica
                if (response.status === 409) {
                    // Get error message from the response
                    const errorMessage = result.message || 'Já existe uma vitrine ativa para esse curso. Desative-a e tente novamente';
                    
                    // Show alert message
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atenção',
                        text: errorMessage,
                        confirmButtonText: 'OK'
                    });
                } else {
                    showError(result.message || 'Erro ao atualizar status');
                }
            }
        } catch (error) {
            console.error('Error updating showcase item status:', error);
            showError('Erro ao atualizar status do item');
            
            // Reset the toggle to its previous state in case of any error
            const toggle = document.querySelector(`.status-toggle[data-id="${id}"]`);
            if (toggle) toggle.checked = status !== 'active';
            
            // Reset the UI to reflect the actual state
            renderShowcaseItems();
        }
    };

    // Open add modal
    const openAddModal = () => {
        form.reset();
        document.getElementById('showcaseItemId').value = '';
        document.getElementById('courseImage').required = true; // Adicionado: input file obrigatório em adicionar item
        document.getElementById('imagePreview').classList.add('hidden');
        document.getElementById('uploadPlaceholder').classList.remove('hidden');
        document.getElementById('videoInputContainer').classList.add('hidden');
        document.getElementById('hasVideo').checked = false;
        document.getElementById('modalTitle').textContent = 'Adicionar Item à Vitrine';
        buttonDelayInput.value = 0;
        buttonDelayInput.disabled = true;
        modal.classList.remove('hidden');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    // Open edit modal
    const openEditModal = (id) => {
        document.getElementById('modalTitle').textContent = 'Editar Item da Vitrine';
        const item = showcaseItems.find(item => item.id === id);
        
        if (!item) return;
        
        document.getElementById('showcaseItemId').value = item.id;
        document.getElementById('courseImage').required = false; // Adicionado: retirada da obrigatoriedade em editar item
        document.getElementById('courseName').value = item.name;
        document.getElementById('courseDescription').value = item.description;
        document.getElementById('buttonText').value = item.button_text || '';
        document.getElementById('buyLink').value = item.button_link || '';
        document.getElementById('coursePrice').value = item.price || '';
        document.getElementById('priority').value = item.priority || 5;
        document.getElementById('buttonDelay').value = item.button_delay || 0;
        
        // Selecionar o curso correto
        const courseSelect = document.getElementById('courseSelect');
        if (courseSelect) {
            courseSelect.value = item.course_id || '';
        }
        
        // Set video checkbox
        document.getElementById('hasVideo').checked = item.has_video;
        if (item.has_video) {
            document.getElementById('videoInputContainer').classList.remove('hidden');
            document.getElementById('videoUrl').value = item.video_url || '';
        } else {
            document.getElementById('videoInputContainer').classList.add('hidden');
        }
        
        // Fix image preview for existing images
        if (item.image) {
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            const imagePreview = document.getElementById('imagePreview');
            imagePreview.classList.remove('hidden');
            imagePreview.src = `/static/uploads/${item.image}`;
        } else {
            document.getElementById('uploadPlaceholder').classList.remove('hidden');
            document.getElementById('imagePreview').classList.add('hidden');
        }
        
        // Define o estado do input de delay:
        if (document.getElementById('hasVideo').checked) {
            buttonDelayInput.disabled = false;
        } else {
            buttonDelayInput.value = 0;
            buttonDelayInput.disabled = true;
        }
        modal.style.display = 'block';
    };

    // Save showcase item
    const saveShowcaseItem = async (e) => {
        e.preventDefault();
        
        // Validar se um curso foi selecionado
        const courseSelect = document.getElementById('courseSelect');
        if (!courseSelect.value) {
            showError('Por favor, selecione um curso');
            return;
        }
        
        const saveButton = document.getElementById('saveShowcaseBtn');
        const buttonText = saveButton.querySelector('.button-text');
        const spinner = saveButton.querySelector('.spinner');
        
        buttonText.classList.add('hidden');
        spinner.classList.remove('hidden');
        
        const id = document.getElementById('showcaseItemId').value;
        const isNewItem = !id;
        const formData = new FormData(form);
        
        // Garantir que has_video seja enviado corretamente
        const hasVideo = document.getElementById('hasVideo').checked;
        formData.set('has_video', hasVideo ? 'true' : 'false');
        formData.set('course_id', courseSelect.value);

        // Se tem vídeo, garantir que a URL seja enviada
        if (hasVideo) {
            const videoUrl = document.getElementById('videoUrl').value;
            if (!videoUrl) {
                showError('Por favor, insira a URL do vídeo');
                buttonText.classList.remove('hidden');
                spinner.classList.add('hidden');
                return;
            }
            formData.set('video_url', videoUrl);
        } else {
            formData.delete('video_url');
        }
        
        // For edit mode, if no new image is selected and we're editing, don't send empty image field
        const imageInput = document.getElementById('courseImage');
        if (!isNewItem && imageInput.files.length === 0) {
            formData.delete('image');
        }
        
        try {
            const url = isNewItem ? '/admin/api/showcase' : `/admin/api/showcase/${id}`;
            const method = isNewItem ? 'POST' : 'PUT';
            
            const response = await fetch(url, {
                method: method,
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const result = await response.json();
            
            if (result.success) {
                if (isNewItem) {
                    // Atualiza courseName a partir da opção selecionada
                    result.item.courseName = document.getElementById('courseSelect').selectedOptions[0].textContent;
                    showcaseItems.push(result.item);
                } else {
                    const index = showcaseItems.findIndex(item => item.id === parseInt(id));
                    if (index !== -1) {
                        // Atualiza courseName também em edição
                        result.item.courseName = document.getElementById('courseSelect').selectedOptions[0].textContent;
                        showcaseItems[index] = result.item;
                    }
                }
                
                renderShowcaseItems();
                closeModal();
                showSuccess(isNewItem ? 'Item criado com sucesso!' : 'Item atualizado com sucesso!');
            }
        } catch (error) {
            console.error('Error saving showcase item:', error);
            showError('Erro ao salvar item da vitrine');
        } finally {
            buttonText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    };

    // Delete showcase item
    const deleteShowcaseItem = async (id) => {
        if (confirm('Tem certeza de que deseja excluir este item?')) {
            try {
                const response = await fetch(`/admin/api/showcase/${id}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                
                const result = await response.json();
                
                if (result.success) {
                    showcaseItems = showcaseItems.filter(item => item.id !== id);
                    renderShowcaseItems();
                    showSuccess('Item excluído com sucesso!');
                }
            } catch (error) {
                console.error('Error deleting showcase item:', error);
                showError('Erro ao excluir item da vitrine');
            }
        }
    };

    // Close modal
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    };

    // Image preview
    const previewImage = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            const imagePreview = document.getElementById('imagePreview');
            imagePreview.classList.remove('hidden');
            imagePreview.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    };

    // Set up event listeners
    addItemButton.addEventListener('click', openAddModal);
    if (emptyAddItemButton) {
        emptyAddItemButton.addEventListener('click', openAddModal);
    }
    closeButtons.forEach(button => button.addEventListener('click', closeModal));
    form.addEventListener('submit', saveShowcaseItem);
    hasVideoCheckbox.addEventListener('change', function() {
        videoInputContainer.classList.toggle('hidden', !this.checked);
        buttonDelayInput.disabled = !this.checked;
        if (!this.checked) {
            buttonDelayInput.value = 0;
        }
    });
    document.getElementById('courseImage').addEventListener('change', previewImage);
    searchInput.addEventListener('input', renderShowcaseItems);
    filterSelect.addEventListener('change', renderShowcaseItems);
    sortSelect.addEventListener('change', renderShowcaseItems);

    // Handle click outside modal to close
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Set up event listeners for metrics modal
    if (showMetricsButton) {
        showMetricsButton.addEventListener('click', openMetricsModal);
    }
    
    closeMetricsButtons.forEach(button => {
        button.addEventListener('click', closeMetricsModal);
    });
    
    if (applyMetricsFilterButton) {
        applyMetricsFilterButton.addEventListener('click', loadMetricsData);
    }
    
    // Handle metrics modal outside click
    window.addEventListener('click', function(event) {
        if (event.target === metricsModal) {
            closeMetricsModal();
        }
    });

    // Initialize data on page load
    initializeData();
});
