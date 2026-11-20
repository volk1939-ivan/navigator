/* ==========================================================================
   Навигатор — интерактивная часть:
     1) всплывающие окна с библейскими текстами (никаких внешних переходов);
     2) формы «Мой ответ» под каждым вопросом урока;
     3) анонимный номер читателя (без cookie, без аналитики).
   Без сторонних библиотек.
   ========================================================================== */

(function () {
  'use strict';

  var CFG = window.CONFIG || {};

  /* ------------------------------------------------- анонимный номер */

  function readerKey() { return CFG.LOCAL_STORAGE_KEY || 'navigator_reader_id'; }

  function getReaderId() {
    var id = null;
    try { id = localStorage.getItem(readerKey()); } catch (e) { id = null; }
    if (!id) {
      id = 'Читатель #' + (1000 + Math.floor(Math.random() * 9000));
      try { localStorage.setItem(readerKey(), id); } catch (e) { /* приватный режим */ }
    }
    return id;
  }

  /* ---------------------------------------------------------- меню */

  function initNav() {
    var btn = document.querySelector('.nav__toggle');
    var list = document.querySelector('.nav__list');
    if (!btn || !list) { return; }
    btn.addEventListener('click', function () {
      var open = list.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ------------------------------------- окно с текстом стиха */

  var modal = null;
  var lastFocus = null;

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'verseTitle');
    modal.innerHTML =
      '<div class="modal__box">' +
        '<div class="modal__head">' +
          '<h3 class="modal__title" id="verseTitle">Библейский текст</h3>' +
          '<button type="button" class="modal__close" aria-label="Закрыть">&times;</button>' +
        '</div>' +
        '<div class="modal__body">' +
          '<p class="modal__src" id="verseSrc"></p>' +
          '<div id="verseText"></div>' +
        '</div>' +
        '<div class="modal__foot">' +
          '<button type="button" class="btn" data-close>Закрыть</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (ev) {
      if (ev.target === modal ||
          ev.target.hasAttribute('data-close') ||
          ev.target.classList.contains('modal__close')) {
        closeModal();
      }
    });
  }

  function openModal(key) {
    var data = (window.VERSES || {})[key];
    if (!data) { return; }
    if (!modal) { buildModal(); }
    lastFocus = document.activeElement;

    var t = document.getElementById('verseTitle');
    var s = document.getElementById('verseSrc');
    var body = document.getElementById('verseText');
    t.textContent = data.ref || data.title || 'Библейский текст';
    s.textContent = data.src ? ('Источник: ' + data.src) : '';
    body.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = data.text || '';
    body.appendChild(p);

    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    var btn = modal.querySelector('.modal__close');
    if (btn) { btn.focus(); }
  }

  function closeModal() {
    if (!modal || !modal.classList.contains('is-open')) { return; }
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  function initVerses() {
    document.addEventListener('click', function (ev) {
      var el = ev.target;
      while (el && el !== document.body) {
        if (el.getAttribute) {
          var key = el.getAttribute('data-ref') || el.getAttribute('data-verse');
          if (key) {
            ev.preventDefault();
            openModal(key);
            return;
          }
        }
        el = el.parentNode;
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' || ev.keyCode === 27) { closeModal(); }
    });
  }

  function setStatus(el, text, kind) {
    if (!el) { return; }
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* -------------------------------------------------- отправка ответа */

  function buildPayload(block) {
    var form = block.querySelector('.answer-form');
    var ta = form.querySelector('textarea');
    var contact = form.querySelector('input[type="text"]');
    var h1 = document.querySelector('.content h1');
    var lessonNo = document.querySelector('.content .lesson-no');
    return {
      'Анонимный номер': getReaderId(),
      'Страница': block.getAttribute('data-page') ||
                  (h1 ? h1.textContent.trim() : document.title),
      'Урок': block.getAttribute('data-lesson') ||
              (lessonNo ? lessonNo.textContent.trim() : ''),
      'Вопрос': block.getAttribute('data-question') || '',
      'Мой ответ': ta ? ta.value.trim() : '',
      'Контакт для связи': contact ? contact.value.trim() : '',
      'Отправлено': new Date().toLocaleString('ru-RU')
    };
  }

  function sendAnswer(block, form, toggle) {
    var status = form.querySelector('.status');
    var submitBtn = form.querySelector('button[type="submit"]');
    var ta = form.querySelector('textarea');
    var payload = buildPayload(block);

    if (!payload['Мой ответ']) {
      setStatus(status, 'Пожалуйста, напишите ответ в поле «Мой ответ».', 'err');
      if (ta) { ta.focus(); }
      return;
    }

    var subject = (CFG.SUBJECT_PREFIX || 'Навигатор — ответ читателя') +
                  (payload['Вопрос'] ? ' — ' + payload['Вопрос'] : '');
    var url, body;

    if (CFG.PROVIDER === 'web3forms') {
      url = 'https://api.web3forms.com/submit';
      body = { access_key: CFG.ACCESS_KEY, subject: subject, from_name: 'Навигатор' };
    } else {
      url = 'https://formsubmit.co/ajax/' + CFG.EMAIL;
      body = { _subject: subject, _template: 'table', _captcha: 'false' };
      if (payload['Контакт для связи'] && payload['Контакт для связи'].indexOf('@') > -1) {
        body.email = payload['Контакт для связи'];
      }
    }
    for (var k in payload) { if (payload.hasOwnProperty(k)) { body[k] = payload[k]; } }

    if (submitBtn) { submitBtn.disabled = true; }
    setStatus(status, 'Отправляется…');

    var draftKey = 'navigator_draft_' + (block.getAttribute('data-question-id') || 'x');

    var success = function () {
      if (submitBtn) { submitBtn.disabled = false; }
      setStatus(status, 'Спасибо! Ваш ответ отправлен (' + getReaderId() + ').', 'ok');
      if (ta) { ta.value = ''; }
      try { localStorage.removeItem(draftKey); } catch (e) {}
      if (toggle) {
        toggle.setAttribute('data-sent', '1');
        toggle.textContent = 'Ответ отправлен';
      }
    };

    var failure = function () {
      if (submitBtn) { submitBtn.disabled = false; }
      var mail = 'mailto:' + CFG.EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(
          payload['Анонимный номер'] + '\n' + payload['Страница'] + '\n' +
          payload['Урок'] + '\n' + payload['Вопрос'] + '\n\n' + payload['Мой ответ'] +
          (payload['Контакт для связи'] ? '\n\nКонтакт: ' + payload['Контакт для связи'] : ''));
      if (status) {
        status.className = 'status err';
        status.innerHTML = 'Сервис отправки недоступен. ' +
          '<a class="link" href="' + mail.replace(/"/g, '%22') + '">Отправить письмо вручную</a>';
      }
    };

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return {}; })
          .then(function (json) { return { httpOk: res.ok, json: json }; });
      })
      .then(function (r) {
        var ok;
        if (r.json && typeof r.json.success !== 'undefined') {
          ok = (r.json.success === true || r.json.success === 'true');
        } else {
          ok = r.httpOk;
        }
        if (ok) { success(); } else { failure(); }
      })
      .catch(function () { failure(); });
  }

  function initAnswerBlock(block) {
    var toggle = block.querySelector('.answer-toggle');
    var form = block.querySelector('.answer-form');

    /* если разметки формы ещё нет — создаём её */
    if (!toggle || !form) {
      var question = block.getAttribute('data-question') || '';
      var id = block.getAttribute('data-question-id') || ('q' + Math.random().toString(36).slice(2, 7));
      var reader = getReaderId();

      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'answer-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Оставить ответ';

      form = document.createElement('form');
      form.className = 'answer-form';
      form.setAttribute('novalidate', 'novalidate');
      form.innerHTML =
        '<h4>Мой ответ</h4>' +
        '<p class="answer-context">' +
          (question ? 'Вопрос: ' + esc(question) + ' · ' : '') +
          'Ваш анонимный номер: ' + esc(reader) +
        '</p>' +
        '<label for="ta-' + id + '">Мой ответ</label>' +
        '<textarea id="ta-' + id + '" rows="5" placeholder="Напишите здесь свой ответ…"></textarea>' +
        '<label for="c-' + id + '">Контакт для связи (по желанию, если хотите получить ответ инструктора)</label>' +
        '<input type="text" id="c-' + id + '" placeholder="Например: e-mail или телефон">' +
        '<div class="row">' +
          '<button type="submit" class="btn">Отправить</button>' +
          '<span class="status" role="status" aria-live="polite"></span>' +
        '</div>' +
        '<p class="hint">Ответ отправляется анонимно — только с номером читателя. ' +
        'Мы не собираем персональные данные, не используем cookie и аналитику.</p>';

      block.appendChild(toggle);
      block.appendChild(form);
    }

    var ta = form.querySelector('textarea');
    var draftKey = 'navigator_draft_' + (block.getAttribute('data-question-id') || 'x');
    if (ta) {
      try {
        var saved = localStorage.getItem(draftKey);
        if (saved) { ta.value = saved; }
      } catch (e) {}
      ta.addEventListener('input', function () {
        try { localStorage.setItem(draftKey, ta.value); } catch (e) {}
      });
    }

    toggle.addEventListener('click', function () {
      var open = form.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (toggle.getAttribute('data-sent') === '1') {
        toggle.textContent = open ? 'Свернуть' : 'Ответ отправлен';
      } else {
        toggle.textContent = open ? 'Свернуть' : 'Оставить ответ';
      }
      if (open) {
        var field = form.querySelector('textarea');
        if (field) { field.focus(); }
      }
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      sendAnswer(block, form, toggle);
    });
  }

  function initAnswers() {
    var blocks = document.querySelectorAll('.answers');
    for (var i = 0; i < blocks.length; i++) { initAnswerBlock(blocks[i]); }
  }

  function initImages() {
    var imgs = document.querySelectorAll('p.img img');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        var drop = function () {
          var box = img.parentNode;
          if (box && box.parentNode) { box.parentNode.removeChild(box); }
        };
        img.addEventListener('error', drop);
        if (img.complete && img.naturalWidth === 0) { drop(); }
      })(imgs[i]);
    }
  }

  /* ------------------------------------------------------------ старт */

  function start() {
    initNav();
    initVerses();
    initAnswers();
    initImages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

