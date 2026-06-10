    (function () {
      const STORAGE_KEY = 'todomaster-data';

      // --- DOM refs ---
      const $ = (s) => document.querySelector(s);
      const $$ = (s) => document.querySelectorAll(s);

      const taskInput     = $('#taskInput');
      const btnAdd        = $('#btnAdd');
      const prioritySelect = $('#prioritySelect');
      const dateInput     = $('#dateInput');
      const taskList      = $('#taskList');
      const emptyState    = $('#emptyState');
      const searchInput   = $('#searchInput');
      const sidebar       = $('#sidebar');
      const sidebarOverlay = $('#sidebarOverlay');
      const btnHamburger  = $('#btnHamburger');
      const toastContainer = $('#toastContainer');
      const listTitle     = $('#listTitle');
      const listCount     = $('#listCount');

      // --- State ---
      let todos = [];
      let currentFilter = 'all';
      let undoTimer   = null;

      // --- Data ---
      function load() {
        try { todos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch (e) { todos = []; }
      }

      function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); }

      // --- Helpers ---
      function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0');
      }

      function isOverdue(todo) {
        if (todo.completed || !todo.dueDate) return false;
        return todo.dueDate < todayStr();
      }

      function isToday(todo) {
        if (!todo.dueDate) return false;
        return todo.dueDate === todayStr();
      }

      function priorityWeight(p) {
        return { high: 3, medium: 2, low: 1 }[p] || 0;
      }

      // --- Filtering & Sorting ---
      function filteredTodos() {
        let result = [...todos];
        const search = searchInput.value.trim().toLowerCase();

        if (search) {
          result = result.filter(t => t.text.toLowerCase().includes(search));
        }

        switch (currentFilter) {
          case 'pending': result = result.filter(t => !t.completed); break;
          case 'done':    result = result.filter(t => t.completed); break;
          case 'high':    result = result.filter(t => t.priority === 'high'); break;
          case 'medium':  result = result.filter(t => t.priority === 'medium'); break;
          case 'low':     result = result.filter(t => t.priority === 'low'); break;
          case 'today':   result = result.filter(t => isToday(t)); break;
          case 'overdue': result = result.filter(t => isOverdue(t)); break;
        }

        if (currentFilter === 'priority') {
          result.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
        } else {
          result.sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
          });
        }

        return result;
      }

      // --- Badge counts ---
      function updateBadges() {
        const total = todos.length;
        const done = todos.filter(t => t.completed).length;
        const pending = total - done;
        const high = todos.filter(t => t.priority === 'high').length;
        const medium = todos.filter(t => t.priority === 'medium').length;
        const low = todos.filter(t => t.priority === 'low').length;
        const today = todos.filter(t => isToday(t)).length;
        const overdue = todos.filter(t => isOverdue(t)).length;

        $('#badgeAll').textContent = total;
        $('#badgePending').textContent = pending;
        $('#badgeDone').textContent = done;
        $('#badgeHigh').textContent = high;
        $('#badgeMedium').textContent = medium;
        $('#badgeLow').textContent = low;
        $('#badgeToday').textContent = today;
        $('#badgeOverdue').textContent = overdue;

        $('#statTotal').textContent = total;
        $('#statPending').textContent = pending;
        $('#statDone').textContent = done;
        $('#statOverdue').textContent = overdue;

        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        $('#progressPercent').textContent = pct + '%';
        $('#progressFill').style.width = pct + '%';
      }

      function updateListHeader() {
        const items = filteredTodos();
        listCount.textContent = items.length + ' 项';

        const labels = {
          all: '全部任务', pending: '未完成任务', done: '已完成任务',
          high: '高优先级', medium: '中优先级', low: '低优先级',
          today: '今日任务', overdue: '已逾期任务'
        };
        listTitle.textContent = labels[currentFilter] || '全部任务';
      }

      // --- Render ---
      function createTaskElement(todo, index) {
        const realIndex = todos.indexOf(todo);
        const li = document.createElement('li');
        li.className = 'task-item' + (todo.completed ? ' completed' : '');
        li.dataset.index = realIndex;

        // checkbox
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'task-checkbox';
        cb.checked = todo.completed;
        cb.setAttribute('aria-label', '标记完成');
        cb.addEventListener('change', () => {
          todos[realIndex].completed = cb.checked;
          save();
          renderAll();
        });

        // priority badge
        const badge = document.createElement('span');
        badge.className = 'priority-badge ' + todo.priority;
        badge.textContent = { high: '高', medium: '中', low: '低' }[todo.priority] || '中';

        // content
        const content = document.createElement('div');
        content.className = 'task-content';

        const text = document.createElement('span');
        text.className = 'task-text';
        text.textContent = todo.text;

        const meta = document.createElement('div');
        meta.className = 'task-meta';

        if (todo.dueDate) {
          const dateSpan = document.createElement('span');
          dateSpan.className = 'due-date' + (isOverdue(todo) && !todo.completed ? ' overdue' : '');
          dateSpan.textContent = '📅 ' + todo.dueDate;
          meta.appendChild(dateSpan);
        }

        const createdSpan = document.createElement('span');
        createdSpan.textContent = '🕐 ' + todo.createdAt;
        meta.appendChild(createdSpan);

        content.appendChild(text);
        content.appendChild(meta);

        // actions
        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-task delete';
        btnDel.innerHTML = '🗑';
        btnDel.title = '删除';
        btnDel.setAttribute('aria-label', '删除任务');
        btnDel.addEventListener('click', () => removeTask(realIndex, li));

        actions.appendChild(btnDel);

        li.appendChild(cb);
        li.appendChild(badge);
        li.appendChild(content);
        li.appendChild(actions);
        return li;
      }

      function renderAll() {
        taskList.innerHTML = '';
        const items = filteredTodos();
        items.forEach(todo => {
          taskList.appendChild(createTaskElement(todo, todos.indexOf(todo)));
        });

        emptyState.style.display = items.length === 0 ? '' : 'none';
        updateBadges();
        updateListHeader();
      }

      // --- Add task ---
      function addTask() {
        const text = taskInput.value.trim();
        if (!text) return;

        const now = new Date();
        const createdAt = now.getFullYear() + '-' +
              String(now.getMonth() + 1).padStart(2, '0') + '-' +
              String(now.getDate()).padStart(2, '0');

        todos.push({
          text: text,
          completed: false,
          priority: prioritySelect.value,
          dueDate: dateInput.value || null,
          createdAt: createdAt
        });

        save();
        taskInput.value = '';
        dateInput.value = '';
        prioritySelect.value = 'medium';
        renderAll();
        taskInput.focus();
      }

      // --- Remove task ---
      function removeTask(index, liElement) {
        const removed = todos[index];
        if (!removed || liElement.dataset.deleting === 'true') return;
        liElement.dataset.deleting = 'true';
        let finished = false;
        let fallbackTimer = null;

        liElement.style.animation = 'none';
        void liElement.offsetHeight;
        liElement.style.animation = '';
        liElement.classList.add('removing');

        function done() {
          if (finished) return;
          finished = true;
          clearTimeout(fallbackTimer);

          todos.splice(index, 1);
          save();
          renderAll();
          showUndoToast(removed);
        }

        liElement.addEventListener('animationend', done, { once: true });
        fallbackTimer = setTimeout(() => {
          if (liElement.classList.contains('removing')) done();
        }, 400);
      }

      // --- Undo ---
      function showUndoToast(task) {
        clearTimeout(undoTimer);

        // remove old undo toasts
        $$('.toast.undo').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'toast undo';
        toast.innerHTML = `
          <span>已删除「${task.text.slice(0, 18)}${task.text.length > 18 ? '…' : ''}」</span>
          <button class="toast-action">撤销</button>
        `;

        toast.querySelector('.toast-action').addEventListener('click', () => {
          todos.push(task);
          save();
          renderAll();
          dismissToast(toast);
        });

        toastContainer.appendChild(toast);

        undoTimer = setTimeout(() => dismissToast(toast), 5000);
      }

      function dismissToast(toast) {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
      }

      // --- Clear done ---
      function clearDoneTasks() {
        const count = todos.filter(t => t.completed).length;
        if (count === 0) return;
        if (!confirm('确定要清除所有已完成的任务吗？')) return;

        todos = todos.filter(t => !t.completed);
        save();
        renderAll();
      }

      // --- Events ---
      btnAdd.addEventListener('click', addTask);
      taskInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') addTask();
      });

      searchInput.addEventListener('input', renderAll);

      // --- Sidebar filter ---
      $$('.nav-item[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentFilter = btn.dataset.filter;
          $$('.nav-item[data-filter]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderAll();

          // close sidebar on mobile
          if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('show');
          }
        });
      });

      // --- Mobile sidebar ---
      btnHamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('show');
      });

      sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
      });

      // --- Keyboard shortcut: Ctrl+K for search ---
      document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          searchInput.focus();
        }
      });

      // --- Init ---
      load();
      renderAll();
    })();
