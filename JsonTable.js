
class JsonTable {
	constructor(options) {
		this.jsonUrl = options.jsonUrl || '';
		this.rowsPerPage = options.rowsPerPage || 10;
		this.container = document.querySelector(options.container || '#jsonTable');
		this.globalSearchInput = document.querySelector(options.globalSearch || '#globalSearch');
		this.paginationContainer = document.querySelector(options.pagination || '#pagination');
		this.columns = options.columns || []; // Array of objects defining column settings
		this.allowEdit = options.allowEdit || false; // Whether to enable editing
		this.editPlacement = options.editPlacement || 'start'; // 'start' or 'end'
		this.editSaveUrl = options.editSaveUrl || ''; // Added editSaveUrl
		this.editSaveAdditionalData = options.editSaveAdditionalData || {}; // Added editSaveAdditionalData
		this.toastWrapper = options.toastWrapper || ''; // Added toastWrapper
		this.toastBody = options.toastBody || ''; // Added toastBody

		this.data = [];
		this.currentPage = 1;
		this.sortColumn = null;
		this.sortOrder = 'asc';
		this.filteredPages = 0;
		this.filteredData = [];

		this.init();
	}

	async init() {
		await this.fetchData();
		this.renderTable();
		this.addGlobalSearchListener();
	}

	async fetchData() {
		try {
			const response = await fetch(this.jsonUrl);
			this.data = await response.json();
			this.filteredData = [...this.data];
		} catch (error) {
			console.error('Error fetching JSON data:', error);
		}
	}

	renderTable(which = 'all') {
		if (which == 'all') {
			this.renderHeader();
			this.renderRows();
			this.renderFooter();
			this.renderPagination();
		} else {
			this.renderRows();
			this.renderPagination();
		}
	}

	renderHeader() {
		const tableHeader = this.container.querySelector('thead');
		tableHeader.innerHTML = '<tr></tr>';
		const headerRow = tableHeader.querySelector('tr');

		// Add edit column if allowEdit is true
		if (this.allowEdit && this.editPlacement === 'start') {
			headerRow.insertAdjacentHTML('afterbegin', `<th>Edit</th>`);
		}

		this.columns.forEach((column) => {
			const th = document.createElement('th');
			th.textContent = column.title;

			if (column.sortable !== false) {
				th.classList.add('sortable');
				th.dataset.column = column.key;
				th.addEventListener('click', () => this.toggleSort(column.key));
			}

			headerRow.appendChild(th);
		});

		if (this.allowEdit && this.editPlacement === 'end') {
			headerRow.insertAdjacentHTML('beforeend', `<th>Edit</th>`);
		}
	}

	renderFooter() {
		const tableFooter = this.container.querySelector('tfoot');
		tableFooter.innerHTML = '<tr></tr>';
		const footerRow = tableFooter.querySelector('tr');

		// Add edit column if allowEdit is true
		if (this.allowEdit && this.editPlacement === 'start') {
			footerRow.insertAdjacentHTML('afterbegin', `<td></td>`);
		}

		this.columns.forEach((column) => {
			const td = document.createElement('td');
			if (column.searchType === 'select') {
				const select = document.createElement('select');
				select.className = 'form-control';
				select.innerHTML = `<option value="">All ${column.title}</option>`;
				const uniqueValues = [...new Set(this.data.map(row => row[column.key]))];
				uniqueValues.forEach(value => {
					const option = document.createElement('option');
					option.textContent = value;
					option.value = value;
					select.appendChild(option);
				});
				select.addEventListener('change', (e) => this.filterColumn(column.key, e.target.value));
				td.appendChild(select);
			} else if (column.searchType !== false) {
				const input = document.createElement('input');
				input.type = 'text';
				input.className = 'form-control';
				input.placeholder = `Search ${column.title}`;
				input.addEventListener('input', (e) => this.filterColumn(column.key, e.target.value));
				td.appendChild(input);
			}
			footerRow.appendChild(td);
		});
	}

	renderRows() {
		const tableBody = this.container.querySelector('tbody');
		tableBody.innerHTML = '';
		const start = (this.currentPage - 1) * this.rowsPerPage;
		const end = start + this.rowsPerPage;

		let rows = [...this.filteredData];

		// Sorting
		if (this.sortColumn) {
			rows.sort((a, b) => {
				if (this.sortOrder === 'asc') return a[this.sortColumn] > b[this.sortColumn] ? 1 : -1;
				return a[this.sortColumn] < b[this.sortColumn] ? 1 : -1;
			});
		}

		// Paging
		const totalPages = Math.ceil(rows.length / this.rowsPerPage);
		this.filteredPages = totalPages;

		rows.slice(start, end).forEach((row, rowIndex) => {
			const tr = document.createElement('tr');

			// Add edit column if allowEdit is true
			if (this.allowEdit && this.editPlacement === 'start') {
				tr.insertAdjacentHTML('afterbegin', `<td><button class="btn btn-primary btn-sm edit-btn" data-row="${rowIndex}"><i class="bi bi-pencil-square"></i></button></td>`);
			}

			Object.keys(row).forEach((key) => {
				const td = document.createElement('td');
				td.textContent = row[key];
				tr.appendChild(td);
			});

			if (this.allowEdit && this.editPlacement === 'end') {
				tr.insertAdjacentHTML('beforeend', `<td><button class="btn btn-primary btn-sm edit-btn" data-row="${rowIndex}"><i class="bi bi-pencil-square"></i></button></td>`);
			}

			tableBody.appendChild(tr);
		});

		// Add event listeners for edit buttons
		if (this.allowEdit) {
			this.container.querySelectorAll('.edit-btn').forEach((btn) =>
				btn.addEventListener('click', (e) => this.showEditModal(parseInt(btn.dataset.row, 10)))
			);
		}
	}

	renderPagination() {
		this.paginationContainer.innerHTML = '';
		const totalPages = this.filteredPages;
		const currentPage = this.currentPage;
		const maxVisiblePages = 6; // Adjust this number as needed

		if (totalPages <= maxVisiblePages) {
			// If total pages are less than or equal to maxVisiblePages, show all pages
			for (let i = 1; i <= totalPages; i++) {
				this.renderPageLink(i, currentPage);
			}
		} else {
			// Determine which pages to display based on current page
			let pagesToShow = [];

			// Always show first 2 pages
			pagesToShow.push(1);
			pagesToShow.push(2);

			// Calculate mid range around current page
			const leftRange = Math.max(currentPage - 2, 3); // Always show at least 2 pages before
			const rightRange = Math.min(currentPage + 2, totalPages - 2); // Always show at least 2 pages after

			// Show range of pages
			for (let i = leftRange; i <= rightRange; i++) {
				pagesToShow.push(i);
			}

			// Always show last 2 pages
			pagesToShow.push(totalPages - 1);
			pagesToShow.push(totalPages);

			// Render the pages with "..." as needed
			for (let i = 0; i < pagesToShow.length; i++) {
				const pageNumber = pagesToShow[i];
				if (i > 0 && pageNumber - pagesToShow[i - 1] > 1) {
					// There's a gap between pages, add "..."
					this.renderPaginationGap();
				}
				this.renderPageLink(pageNumber, currentPage);
			}
		}
	}

	renderPageLink(pageNumber, currentPage) {
		const li = document.createElement('li');
		li.className = 'page-item';
		if (pageNumber === currentPage) {
			li.classList.add('active');
		}

		const a = document.createElement('a');
		a.className = 'page-link';
		a.textContent = pageNumber;
		a.href = '#';
		a.addEventListener('click', (e) => {
			e.preventDefault();
			this.currentPage = pageNumber;
			this.renderRows();
			this.renderPagination();
			this.updateActivePage(pageNumber);
		});

		li.appendChild(a);
		this.paginationContainer.appendChild(li);
	}

	renderPaginationGap() {
		const li = document.createElement('li');
		li.className = 'page-item disabled';
		const span = document.createElement('span');
		span.className = 'page-link';
		span.textContent = '...';
		li.appendChild(span);
		this.paginationContainer.appendChild(li);
	}

	updateActivePage(page) {
		const paginationItems = this.paginationContainer.querySelectorAll('.page-item');
		paginationItems.forEach(item => {
			item.classList.remove('active');
			const link = item.querySelector('.page-link');
			if (link.textContent === String(page)) {
				item.classList.add('active');
			}
		});
	}

	showEditModal(rowIndex) {
		const rowData = this.filteredData[rowIndex];
		const modal = document.querySelector('#editModal');
		const modalBody = modal.querySelector('.modal-body');
		modalBody.innerHTML = '';

		this.columns.forEach((column) => {
			const fieldType = column.editFieldType || 'text';
			const inputWrapper = document.createElement('div');
			let isFloating = false
			inputWrapper.classList.add('mb-3');


			if (column.editFieldType !== false) {
				const floating = document.createElement('div');
				const floatingLabel = document.createElement('label');
				if (column.columnIcon) {
					inputWrapper.classList.add('input-group')
					const iconSpan = document.createElement('span');
					iconSpan.className = 'input-group-text';
					const icon = document.createElement('i');
					icon.className = column.columnIcon;
					iconSpan.appendChild(icon);
					inputWrapper.appendChild(iconSpan);
					floating.className = 'floating-label'
					floatingLabel.textContent = column.title;
					isFloating = true
				} else {
					const label = document.createElement('label');
					label.className = 'form-label';
					label.textContent = column.title;
					inputWrapper.appendChild(label);
				}

				let input;

				switch (fieldType) {
					case 'bool':
						input = document.createElement('input');
						input.type = 'checkbox';
						input.checked = !!rowData[column.key];
						break;
					case 'select':
						input = document.createElement('select');
						input.className = 'form-control';
						column.options.forEach((opt) => {
							const option = document.createElement('option');
							option.value = opt;
							option.textContent = opt;
							option.selected = rowData[column.key] === opt;
							input.appendChild(option);
						});
						break;
					case 'textarea':
						input = document.createElement('textarea');
						input.className = 'form-control';
						input.textContent = rowData[column.key];
						input.placeholder = column.title;
						break;
					default:
						input = document.createElement('input');
						input.type = fieldType;
						input.className = 'form-control';
						input.value = rowData[column.key];
						input.placeholder = column.title;
						break;
				}

				input.dataset.key = column.key;
				if(isFloating == true){
					floating.appendChild(input);
					floating.appendChild(floatingLabel);
					inputWrapper.appendChild(floating);
				} else {
					inputWrapper.appendChild(input);
				}
				modalBody.appendChild(inputWrapper);
			} else {
				const input = document.createElement('input');
				input.type = 'hidden';
				input.value = rowData[column.key];
				input.dataset.key = column.key;
				modalBody.appendChild(input);
			}
		});

		const saveBtn = modal.querySelector('.save-edit');
		saveBtn.onclick = () => this.saveEdit(rowIndex, modal);

		const modalInstance = new bootstrap.Modal(modal);
		modalInstance.show();
	}

	addGlobalSearchListener() {
		if (this.globalSearchInput) {
			this.globalSearchInput.addEventListener('input', (e) => this.filterGlobal(e.target.value));
		}
	}

	filterGlobal(value) {
		const lowerValue = value.toLowerCase();
		this.filteredData = this.data.filter((row) =>
			Object.values(row).some((field) => String(field).toLowerCase().includes(lowerValue))
		);
		this.currentPage = 1;
		this.renderTable();
	}

	filterColumn(key, value) {
		// Filter data based on specific column key and input value

		// Update filteredData based on current search criteria
		if (value === '') {
			// If search value is empty, reset to original data
			this.filteredData = [...this.data];
		} else {
			// Perform filtering based on the key and value
			const lowerCaseValue = value.toLowerCase();

			this.filteredData = this.data.filter((row) => {
				if (this.columns.find((col) => col.key === key && col.searchType === 'select')) {
					// For select dropdown filtering
					return row[key].toLowerCase() === lowerCaseValue;
				} else {
					// For text input filtering
					return row[key].toLowerCase().includes(lowerCaseValue);
				}
			});
		}

		// Re-render table rows and pagination after filtering
		this.currentPage = 1; // Reset to first page
		this.renderTable('rows');
	}

	adjustTfootSearchFields() {
		// Adjust tfoot search fields based on editPlacement
		const tfoot = this.container.querySelector('tfoot');
		if (this.allowEdit && this.editPlacement === 'start') {
			// If edit column is at the start, move tfoot search fields over by 1
			const th = document.createElement('th');
			th.textContent = ''; // Adjust as needed based on your table structure
			tfoot.insertBefore(th, tfoot.firstElementChild); // Adjust based on your specific structure
		}
	}

	toggleSort(column) {
		if (this.sortColumn === column) {
			this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortColumn = column;
			this.sortOrder = 'asc';
		}
		this.renderRows();
	}

	async saveEdit(rowIndex, modal) {
		const rowData = this.filteredData[rowIndex];
		const editSaveUrl = this.editSaveUrl || '';
		const editSaveAdditionalData = this.editSaveAdditionalData || {};

		const formData = {};
		const additionalData = {};

		const inputs = modal.querySelectorAll('[data-key]');
		inputs.forEach((input) => {
			const key = input.dataset.key;
			if (key && input.type !== 'button' && input.type !== 'submit' && input.type !== 'reset') {
				if (input.type === 'checkbox') {
					formData[key] = input.checked;
				} else {
					formData[key] = input.value;
				}
			}
		});

		for (let [key, value] of Object.entries(editSaveAdditionalData)) {
			additionalData[key] = value;
		}

		const postData = {
			...formData,
			...additionalData,
		};

		try {
			let type = 'success';
			let msg = '';
			const response = await fetch(editSaveUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(postData),
			});

			if (!response.ok) {
				throw new Error('Failed to save data');
			}

			const responseData = await response.json();

			// Update the data in the table with the edited values
			Object.keys(formData).forEach((key) => {
				rowData[key] = formData[key];
			});

			// Rerender the table
			this.renderRows();

			if (responseData.msg) {
				msg = responseData.msg
			} else {
				msg = responseData
			}
			if (responseData?.status) {
				type = responseData.status
			}
			// Show success toast
			this.showToast(type, msg); //'Data saved successfully');
		} catch (error) {
			console.error('Error saving data:', error);
			this.showToast('error', 'Failed to save data. Please try again.');
		} finally {
			// Close the modal
			const modalInstance = bootstrap.Modal.getInstance(modal);
			modalInstance.hide();
		}
	}

	showToast(type, message) {
		const toastContainer = document.querySelector('#toastContainer .toast');
		const toastResponse = toastContainer.querySelector('.toast-body');
		if (!toastContainer) {
			console.error('Toast container not found');
			return;
		}
		toastResponse.textContent = message;
		toastContainer.classList.remove('text-bg-primary', 'text-bg-warning', 'text-bg-danger', 'text-bg-error', 'text-bg-info', 'text-bg-success');
		toastContainer.classList.add(`text-bg-${type}`, 'fade', 'show');
		setTimeout(function(){
			toastContainer.classList.remove('show')
		}, 7000)
	}
}
