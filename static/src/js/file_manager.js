// Global variables
let currentPage = 1;
let fileType = 'all';
let usageStatus = 'all';
let searchQuery = '';
let totalPages = 1;
let currentFileId = null;
let currentFileName = null;

// Document ready event
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the file manager
    fetchFiles();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize Lucide icons
    lucide.createIcons();
});

// Set up event listeners for filters and pagination
function setupEventListeners() {
    // Filter by file type
    document.getElementById('fileType').addEventListener('change', function() {
        fileType = this.value;
        currentPage = 1;
        fetchFiles();
    });
    
    // Filter by usage status
    document.getElementById('usageFilter').addEventListener('change', function() {
        usageStatus = this.value;
        currentPage = 1;
        fetchFiles();
    });
    
    // Search functionality
    document.getElementById('searchFile').addEventListener('input', function() {
        searchQuery = this.value;
        currentPage = 1;
        fetchFiles();
    });
    
    // Modal close button
    document.querySelector('#confirmModal .close').addEventListener('click', closeModal);
    
    // Cancel delete button
    document.getElementById('cancelDelete').addEventListener('click', closeModal);
    
    // Confirm delete button
    document.getElementById('confirmDelete').addEventListener('click', function() {
        deleteFile(currentFileId, currentFileName);
    });
}

// Close the modal
function closeModal() {
    document.getElementById('confirmModal').style.display = 'none';
    currentFileId = null;
    currentFileName = null;
}

// Fetch files from the server based on filters
function fetchFiles() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '<div class="animate-pulse col-span-full text-center py-8"><i data-lucide="loader" class="h-8 w-8 mx-auto text-gray-400 mb-2 animate-spin"></i><p class="text-gray-500">Carregando arquivos...</p></div>';
    
    // Create the URL with query parameters
    const url = `/admin/files?page=${currentPage}&fileType=${fileType}&status=${usageStatus}&search=${encodeURIComponent(searchQuery)}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            updateFileList(data.files);
            updatePagination(data.totalPages, data.currentPage);
            updateStats(data.stats);
        })
        .catch(error => {
            console.error('Error fetching files:', error);
            fileList.innerHTML = '<div class="text-center py-8 col-span-full"><i data-lucide="alert-triangle" class="h-8 w-8 mx-auto text-red-500 mb-2"></i><p class="text-gray-700">Erro ao carregar arquivos. Tente novamente.</p></div>';
            lucide.createIcons();
        });
}

// Update the file list with the fetched data
function updateFileList(files) {
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    
    if (files.length === 0) {
        fileList.innerHTML = '<div class="text-center py-8 col-span-full"><i data-lucide="search-x" class="h-8 w-8 mx-auto text-gray-400 mb-2"></i><p class="text-gray-500">Nenhum arquivo encontrado</p></div>';
        fileCount.textContent = '0 arquivos encontrados';
        lucide.createIcons();
        return;
    }
    
    fileCount.textContent = `${files.length} arquivo(s) encontrado(s)`;
    fileList.innerHTML = '';
    
    files.forEach(file => {
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card bg-white shadow rounded-lg overflow-hidden';
        
        // Determine file type icon
        let fileIcon = 'file';
        let fileTypeClass = 'text-blue-500';
        
        if (file.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            fileIcon = 'image';
            fileTypeClass = 'text-green-500';
        } else if (file.filename.match(/\.(pdf)$/i)) {
            fileIcon = 'file-text';
            fileTypeClass = 'text-red-500';
        } else if (file.filename.match(/\.(doc|docx)$/i)) {
            fileIcon = 'file-text';
            fileTypeClass = 'text-blue-700';
        } else if (file.filename.match(/\.(xls|xlsx)$/i)) {
            fileIcon = 'file-spreadsheet';
            fileTypeClass = 'text-green-700';
        }
        
        // Check if it's an image to show thumbnail
        const isImage = file.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        fileCard.innerHTML = `
            <div class="file-thumbnail">
                ${isImage 
                    ? `<img src="/static/uploads/${file.filename}" alt="${file.filename}" loading="lazy">`
                    : `<i data-lucide="${fileIcon}" class="h-12 w-12 ${fileTypeClass}"></i>`
                }
                <div class="file-status ${file.is_used ? 'status-used' : 'status-unused'}">
                    ${file.is_used ? 'Em uso' : 'Não utilizado'}
                </div>
            </div>
            <div class="p-4">
                <h4 class="font-medium text-gray-900 mb-1 truncate" title="${file.filename}">${file.filename}</h4>
                <div class="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span>${formatFileSize(file.size)}</span>
                    <span>${formatDate(file.upload_date)}</span>
                </div>
                <div class="file-actions">
                    <a href="/static/uploads/${file.filename}" target="_blank" class="file-action action-view" title="Visualizar">
                        <i data-lucide="eye" class="h-4 w-4 mr-1"></i> Ver
                    </a>
                    <a href="/static/uploads/${file.filename}" download="${file.filename}" class="file-action action-download" title="Download">
                        <i data-lucide="download" class="h-4 w-4 mr-1"></i> Baixar
                    </a>
                    ${!file.is_used ? `
                        <button onclick="confirmDelete(${file.id}, '${file.filename}')" class="file-action action-delete" title="Excluir">
                            <i data-lucide="trash-2" class="h-4 w-4 mr-1"></i> Excluir
                        </button>
                    ` : ''}
                </div>
                ${file.is_used ? `
                    <p class="mt-3 text-xs text-gray-500">
                        <i data-lucide="info" class="h-3 w-3 inline-block mr-1"></i>
                        Usado em: ${file.used_in.join(', ')}
                    </p>
                ` : ''}
            </div>
        `;
        
        fileList.appendChild(fileCard);
    });
    
    lucide.createIcons();
}

// Format file size
function formatFileSize(sizeInBytes) {
    if (sizeInBytes < 1024) {
        return sizeInBytes + ' B';
    } else if (sizeInBytes < 1024 * 1024) {
        return (sizeInBytes / 1024).toFixed(1) + ' KB';
    } else {
        return (sizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Update pagination
function updatePagination(total, current) {
    totalPages = total;
    currentPage = current;
    
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'px-3 py-1 rounded-md text-gray-500 hover:bg-gray-100';
    prevButton.innerHTML = '<i data-lucide="chevron-left" class="h-4 w-4"></i>';
    prevButton.disabled = current <= 1;
    prevButton.addEventListener('click', () => {
        if (current > 1) {
            currentPage--;
            fetchFiles();
        }
    });
    pagination.appendChild(prevButton);
    
    // Add page numbers
    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(total, startPage + 4);
    
    if (endPage - startPage < 4 && startPage > 1) {
        startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = i === current 
            ? 'px-3 py-1 rounded-md bg-primary text-white' 
            : 'px-3 py-1 rounded-md text-gray-500 hover:bg-gray-100';
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => {
            currentPage = i;
            fetchFiles();
        });
        pagination.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'px-3 py-1 rounded-md text-gray-500 hover:bg-gray-100';
    nextButton.innerHTML = '<i data-lucide="chevron-right" class="h-4 w-4"></i>';
    nextButton.disabled = current >= total;
    nextButton.addEventListener('click', () => {
        if (current < total) {
            currentPage++;
            fetchFiles();
        }
    });
    pagination.appendChild(nextButton);
    
    lucide.createIcons();
}

// Update statistics
function updateStats(stats) {
    document.getElementById('totalFiles').textContent = stats.totalFiles;
    document.getElementById('usedSpace').textContent = formatFileSize(stats.totalSize);
    document.getElementById('unusedFiles').textContent = stats.unusedFiles;
}

// Confirm file deletion
function confirmDelete(fileId, fileName) {
    currentFileId = fileId;
    currentFileName = fileName;
    document.getElementById('confirmModal').style.display = 'block';
}

// Delete file
function deleteFile(fileId, fileName) {
    // Para IDs negativos (arquivos não registrados no banco), usamos uma string '-1'
    let url = `/admin/files/${fileId < 0 ? '-1' : fileId}`;
    
    // Se o ID for negativo, precisamos passar o nome do arquivo como parâmetro de consulta
    if (fileId < 0 && fileName) {
        url += `?filename=${encodeURIComponent(fileName)}`;
    }
    
    fetch(url, { method: 'DELETE' })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || `Erro: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Refresh file list
                fetchFiles();
                // Close modal
                closeModal();
            } else {
                alert('Erro ao excluir arquivo: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error deleting file:', error);
            alert('Ocorreu um erro ao excluir o arquivo: ' + error.message);
        });
}

// Handle window click to close modal
window.onclick = function(event) {
    const modal = document.getElementById('confirmModal');
    if (event.target === modal) {
        closeModal();
    }
};