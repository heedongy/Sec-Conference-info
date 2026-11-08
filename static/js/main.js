---
---
$(function() {
  var FILTER_KEY = '{{ site.domain }}_filter_v3';
  var FAVORITES_KEY = 'conf_favorites';
  var FLASH_CLASSES = 'border border-3 border-warning'; // Bootstrap utilities, used to flash a target
  var SCROLL_OFFSET = 100;

  // ========== Data from Jekyll (_data/conferences.yml) ==========

  // One entry per edition that lists deadlines; ids are the card ids, one per deadline.
  var EDITIONS = [
    {% for conf in site.data.conferences %}{% for edition in conf.editions %}{% if edition.deadline %}
    {% assign range_end = edition.deadline.size | minus: 1 %}
    {
      name: {{ conf.name | jsonify }},
      year: {{ edition.year }},
      timezone: {{ edition.timezone | jsonify }},
      deadlines: {{ edition.deadline | jsonify }},
      ids: [{% for i in (0..range_end) %}{{ conf.name | append: edition.year | append: '-' | append: i | slugify | jsonify }}{% unless forloop.last %}, {% endunless %}{% endfor %}]
    },
    {% endif %}{% endfor %}{% endfor %}
  ];

  // Editions with a known date range ("YYYY-MM-DD/YYYY-MM-DD"), for the calendar.
  var CONFERENCE_DATES = [
    {% for conf in site.data.conferences %}{% for edition in conf.editions %}{% if edition.date and edition.date != "TBA" %}
    { name: {{ conf.name | append: " " | append: edition.year | jsonify }}, place: {{ edition.place | jsonify }}, date: {{ edition.date | jsonify }} },
    {% endif %}{% endfor %}{% endfor %}
  ];

  // ========== State ==========

  var deadlineByConf = {}; // card id -> deadline (moment in local time), null while TBA
  var allDeadlines = {};   // 'YYYY-MM-DD' -> [{id, name, time}]
  var allConferenceDates = {}; // 'YYYY-MM-DD' -> [{name, place}]
  var currentMonth = moment();
  var favorites = loadFavorites();
  var hasSavedFilters = !!store.get(FILTER_KEY);
  var filterState = loadFilters();

  // ========== Helpers ==========

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function escapeHtml(text) {
    return $('<div>').text(text == null ? '' : text).html();
  }

  function flash($el) {
    $el.addClass(FLASH_CLASSES);
    setTimeout(function() { $el.removeClass(FLASH_CLASSES); }, 2000);
  }

  function scrollToElement($el) {
    $('html, body').animate({ scrollTop: $el.offset().top - SCROLL_OFFSET }, 500);
  }

  // ========== Deadlines: countdown, calendar link, card state ==========

  function countdownPart(modifier, number, unit) {
    return '<span class="cd-part' + modifier + '"><b>' + number + '</b><i>' + unit + '</i></span>';
  }

  function countdownHtml(offset) {
    return countdownPart(' cd-part--days', offset.totalDays, offset.totalDays === 1 ? 'day' : 'days') +
      countdownPart('', pad2(offset.hours), 'h') +
      countdownPart('', pad2(offset.minutes), 'm') +
      countdownPart('', pad2(offset.seconds), 's');
  }

  // Badge colour step by days left: 10 or fewer, 20 or fewer, 30 or fewer
  function urgencyOf(daysLeft) {
    if (daysLeft <= 10) return 'now';
    if (daysLeft <= 20) return 'soon';
    if (daysLeft <= 30) return 'later';
    return null;
  }

  function daysLeftLabel(daysLeft) {
    if (daysLeft === 0) return 'Due Today!';
    return daysLeft === 1 ? '1 Day Left' : daysLeft + ' Days Left';
  }

  // Deadlines without a timezone are Anywhere on Earth. "%y" / "%Y" stand for the edition year / the year before.
  function parseDeadline(text, year, timezone) {
    var deadline = moment.tz(text.replace('%y', year).replace('%Y', year - 1), timezone || 'Etc/GMT+12');
    if (deadline.minutes() === 0) {
      deadline.subtract(1, 'seconds'); // midnight counts as the end of the previous day
    }
    if (deadline.minutes() === 59) {
      deadline.seconds(59);
    }
    return deadline;
  }

  // Abbreviation of the visitor's zone (e.g. KST); falls back to a UTC offset when the zone has no abbreviation
  function localZoneLabel(deadline) {
    var abbr = deadline.clone().tz(moment.tz.guess()).format('z');
    return /^[A-Za-z]+$/.test(abbr) ? abbr : 'UTC' + deadline.format('Z');
  }

  $('#local-zone').text(localZoneLabel(moment()) + ' (UTC' + moment().format('Z') + ')');

  function googleCalendarUrl(deadline, title, details) {
    var format = 'YYYYMMDD[T]HHmmss[Z]';
    var start = deadline.clone().utc().format(format);
    var end = deadline.clone().utc().add(30, 'minutes').format(format);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
      '&dates=' + start + '/' + end + '&details=' + encodeURIComponent(details);
  }

  function markTba(cardId) {
    var $card = $('#' + cardId);
    $card.find('.timer').text('TBA');
    $card.find('.deadline-time').text('-');
    deadlineByConf[cardId] = null;
  }

  function setupDeadline(cardId, deadline, edition) {
    var $card = $('#' + cardId);
    var $timer = $card.find('.timer');
    var $badge = $card.find('.d-day-badge');

    $timer.countdown(deadline.toDate(), function(event) {
      var now = moment();
      var diff = now - deadline;
      var daysLeft = deadline.diff(now, 'days');

      $timer.html(diff <= 0 ? countdownHtml(event.offset) : deadline.fromNow());
      $timer.toggleClass('is-urgent', daysLeft <= 10 && diff < 0);

      var urgency = diff < 0 ? urgencyOf(daysLeft) : null;
      if (urgency) {
        $badge.text(daysLeftLabel(daysLeft)).attr('data-urgency', urgency).show();
      } else {
        $badge.hide();
      }
    });

    if (moment() - deadline > 0) {
      $card.addClass('past');
    }

    // From here on the deadline is shown, stored and put on the calendar in the visitor's local time
    deadline.local();
    var calendarDate = deadline.format('YYYY-MM-DD');

    $card.find('.deadline-time')
      .text(deadline.format('D MMM YYYY, h:mm:ss a') + ' (' + localZoneLabel(deadline) + ')')
      .addClass('is-link')
      .attr('title', 'Show in calendar')
      .on('click', function() {
        scrollToElement($('.calendar'));
        currentMonth = moment(calendarDate, 'YYYY-MM-DD');
        renderCalendar();
        setTimeout(function() {
          flash($('.calendar-day[data-date="' + calendarDate + '"]'));
        }, 100);
      });

    $card.find('.add-calendar-btn').attr('href', googleCalendarUrl(
      deadline,
      edition.name + ' ' + edition.year + ' Deadline',
      'Paper submission deadline for ' + edition.name + ' ' + edition.year
    )).show();

    deadlineByConf[cardId] = deadline;
  }

  EDITIONS.forEach(function(edition) {
    var rawDeadlines = [].concat(edition.deadlines);
    if (rawDeadlines[0] === 'TBA') {
      markTba(edition.ids[0]);
      return;
    }
    rawDeadlines.forEach(function(text, i) {
      setupDeadline(edition.ids[i], parseDeadline(text, edition.year, edition.timezone), edition);
    });
  });

  // ========== Theme ==========

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-bs-theme', theme); // Bootstrap's own dark palette (text-muted, etc.)
    $('#theme-toggle').attr('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

  $('#theme-toggle').on('click', function() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {}
  });

  // ========== Favorites and ordering ==========

  function loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  // TBA and past cards cannot be pinned, even if an old saved favorite points at one
  function isFavorite(cardId) {
    return favorites.indexOf(cardId) !== -1 && !$(document.getElementById(cardId)).is('.tba, .past');
  }

  function syncStar($star) {
    var on = $star.hasClass('active');
    var label = on ? 'Unpin' : 'Pin to top';
    $star.attr({ title: label, 'aria-label': label });
  }

  $('.favorite-star').each(function() {
    $(this).toggleClass('active', isFavorite($(this).data('conf-id')));
    syncStar($(this));
  });

  // Only one favorite at a time; clicking it again clears it
  $('.favorite-star').on('click', function(e) {
    e.preventDefault();
    var cardId = $(this).data('conf-id');
    var wasFavorite = isFavorite(cardId);

    $('.favorite-star').removeClass('active');
    favorites = wasFavorite ? [] : [cardId];
    if (!wasFavorite) {
      $(this).addClass('active');
    }
    $('.favorite-star').each(function() { syncStar($(this)); });

    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    reorderConferences();
    updateConferenceList();
  });

  // Order: upcoming deadlines first, then TBA, then past; the favorite leads its group
  function reorderConferences() {
    var now = moment();
    function group(deadline) {
      return !deadline ? 1 : (deadline.isAfter(now) ? 0 : 2);
    }

    var cards = $('.conf').detach();
    cards.sort(function(a, b) {
      var aDeadline = deadlineByConf[a.id];
      var bDeadline = deadlineByConf[b.id];
      if (group(aDeadline) !== group(bDeadline)) return group(aDeadline) - group(bDeadline);

      if (isFavorite(a.id) !== isFavorite(b.id)) return isFavorite(a.id) ? -1 : 1;

      if (!aDeadline && !bDeadline) {
        return $(a).attr('data-search').localeCompare($(b).attr('data-search'));
      }
      return aDeadline.valueOf() - bDeadline.valueOf();
    });
    $('.conf-container').append(cards);

    // A hairline under the pinned card
    $('.pin-rule').remove();
    var $pinned = $(cards).filter(function() { return isFavorite(this.id); }).first();
    if ($pinned.length) {
      $pinned.after('<div class="pin-rule" aria-hidden="true"></div>');
    }
  }

  reorderConferences();

  // ========== Filters ==========

  function loadFilters() {
    var state = {
      field: 'ALL',
      topconf: 'ALL',
      bkif: [],
      conftype: 'ALL',
      hideTba: false,
      hidePast: false,
      search: ''
    };
    var saved = store.get(FILTER_KEY);
    if (!saved) return state;

    state = saved;
    if (!Array.isArray(state.bkif)) state.bkif = [];
    if (typeof state.search !== 'string') state.search = '';
    return state;
  }

  function saveFilters() {
    store.set(FILTER_KEY, filterState);
  }

  function setFilter(key, value) {
    filterState[key] = value;
    saveFilters();
    updateConferenceList();
  }

  function restoreFilterControls() {
    $('#conf-search').val(filterState.search);
    $('#' + filterState.field + '-radio').prop('checked', true);
    $('#TOP-' + (filterState.topconf === 'YES' ? 'YES' : 'ALL') + '-radio').prop('checked', true);
    $('#' + (filterState.conftype === 'ALL' ? 'TYPE-ALL' : filterState.conftype) + '-radio').prop('checked', true);
    filterState.bkif.forEach(function(bk) {
      $('#' + bk + '-checkbox').prop('checked', true);
    });
    $('#HIDE-PAST-checkbox').prop('checked', !!filterState.hidePast);
    $('#HIDE-TBA-checkbox').prop('checked', !!filterState.hideTba);
  }

  // A card shows when every active filter matches; favorites ignore all filters except "hide TBA"
  function matchesFilters($card) {
    if (filterState.search && ($card.attr('data-search') || '').indexOf(filterState.search) === -1) return false;

    if (filterState.field !== 'ALL' && !$card.hasClass(filterState.field)) return false;

    if (filterState.topconf === 'YES') {
      var topClass = filterState.field === 'ALL' ? null : filterState.field + '-TOP';
      var isTop = topClass ? $card.hasClass(topClass) : ($card.hasClass('SEC-TOP') || $card.hasClass('SE-TOP'));
      if (!isTop) return false;
    }

    if (filterState.bkif.length > 0) {
      var hasBkif = filterState.bkif.some(function(level) { return $card.hasClass(level); });
      if (!hasBkif) return false;
    }

    if (filterState.conftype !== 'ALL' && !$card.hasClass(filterState.conftype)) return false;

    if (filterState.hidePast && $card.hasClass('past')) return false;

    return true;
  }

  function updateConferenceList() {
    var visibleCount = 0;
    $('.conf').each(function() {
      var $card = $(this);
      var show;
      if (filterState.hideTba && $card.hasClass('tba')) {
        show = false;
      } else {
        show = isFavorite(this.id) || matchesFilters($card);
      }
      $card.toggle(show);
      if (show) visibleCount++;
    });
    $('#empty-state').toggle(visibleCount === 0);
  }

  if (hasSavedFilters) {
    restoreFilterControls();
  }
  updateConferenceList();

  $('#conf-search').on('input', function() { setFilter('search', $(this).val().trim().toLowerCase()); });
  $('.field-radio').change(function() { setFilter('field', $(this).val()); });
  $('.top-radio').change(function() { setFilter('topconf', $(this).val()); });
  $('.type-radio').change(function() { setFilter('conftype', $(this).val()); });
  $('.hide-tba-checkbox').change(function() { setFilter('hideTba', $(this).is(':checked')); });
  $('.hide-past-checkbox').change(function() { setFilter('hidePast', $(this).is(':checked')); });
  $('.bkif-checkbox').change(function() {
    setFilter('bkif', $('.bkif-checkbox:checked').map(function() { return this.value; }).get());
  });

  // ========== Card dates ==========

  function formatDateRange(start, end) {
    if (start.year() === end.year() && start.month() === end.month()) {
      return start.format('MMM D') + ' – ' + end.format('D, YYYY');
    }
    if (start.year() === end.year()) {
      return start.format('MMM D') + ' – ' + end.format('MMM D, YYYY');
    }
    return start.format('MMM D, YYYY') + ' – ' + end.format('MMM D, YYYY');
  }

  $('.conf-date-display').each(function() {
    var $el = $(this);
    var start = moment($el.data('start'));
    var end = moment($el.data('end'));
    if (start.isValid() && end.isValid()) {
      $el.text(formatDateRange(start, end));
    }
  });

  // ========== Calendar ==========

  Object.keys(deadlineByConf).forEach(function(cardId) {
    var deadline = deadlineByConf[cardId];
    if (!deadline) return;
    var dateKey = deadline.format('YYYY-MM-DD');
    (allDeadlines[dateKey] = allDeadlines[dateKey] || []).push({
      id: cardId,
      name: cardId.replace(/-\d+$/, '').replace(/-/g, ' ').toUpperCase(), // fallback when the card has no title
      time: deadline.format('HH:mm')
    });
  });

  CONFERENCE_DATES.forEach(function(conference) {
    var range = conference.date.split('/');
    if (range.length < 2) return;
    var day = moment(range[0]);
    var end = moment(range[1]);
    while (day.isSameOrBefore(end)) {
      var dateKey = day.format('YYYY-MM-DD');
      (allConferenceDates[dateKey] = allConferenceDates[dateKey] || []).push({
        name: conference.name,
        place: conference.place
      });
      day.add(1, 'day');
    }
  });

  function detailRow(kind, label, name, sub, targetId) {
    return '<div class="tip-row' + (targetId ? ' info-link' : '') + '"' +
      (targetId ? ' data-target="' + escapeHtml(targetId) + '" role="button" tabindex="0"' : '') + '>' +
      '<span class="tip-kind is-' + kind + '">' + label + '</span>' +
      '<span class="tip-name">' + escapeHtml(name) + (sub ? '<small>' + escapeHtml(sub) + '</small>' : '') + '</span></div>';
  }

  function resetDayDetails() {
    $('#day-title').text('');
    $('#calendar-info-box').html('<p class="day-empty">Hover over a date to see its deadlines and conferences.</p>');
  }

  // One cell of the current month; days with events get a highlight and their details on hover
  function buildDayCell(dateStr, dayNumber, todayStr) {
    var $day = $('<div class="calendar-day"></div>').text(dayNumber).attr('data-date', dateStr);
    if (dateStr === todayStr) {
      $day.addClass('today');
    }

    var deadlines = allDeadlines[dateStr] || [];
    var conferences = allConferenceDates[dateStr] || [];
    $day.toggleClass('has-conference', conferences.length > 0);
    $day.toggleClass('has-deadline', deadlines.length > 0);

    // Deadlines first, then conferences
    var rows = deadlines.map(function(item) {
      var title = $.trim($('#' + item.id + ' .card-title-text').text()) || item.name;
      return detailRow('deadline', 'Deadline', title, item.time, item.id);
    }).concat(conferences.map(function(conference) {
      return detailRow('conference', 'Conference', conference.name, conference.place, null);
    }));

    if (rows.length > 0) {
      var heading = moment(dateStr, 'YYYY-MM-DD').format('MMM D, YYYY (ddd)');
      $day.on('mouseenter', function() {
        $('#day-title').text(heading);
        $('#calendar-info-box').html(rows.join(''));
      });
    }
    return $day;
  }

  function renderCalendar() {
    var $container = $('#calendar-days').empty();

    // The details panel keeps the last hovered day until the month changes
    resetDayDetails();
    $('#calendar-title').text(currentMonth.format('MMMM YYYY'));
    updateTodayButton();

    var leadingDays = currentMonth.clone().startOf('month').day();
    var previousMonthDays = currentMonth.clone().subtract(1, 'month').daysInMonth();
    var monthDays = currentMonth.daysInMonth();
    var todayStr = moment().format('YYYY-MM-DD');
    var monthPrefix = currentMonth.format('YYYY-MM');
    var i;

    for (i = leadingDays - 1; i >= 0; i--) {
      $container.append($('<div class="calendar-day other-month"></div>').text(previousMonthDays - i));
    }
    for (i = 1; i <= monthDays; i++) {
      $container.append(buildDayCell(monthPrefix + '-' + pad2(i), i, todayStr));
    }
    // Fill the grid to six rows with the start of the next month
    var trailingDays = 42 - $container.children().length;
    for (i = 1; i <= trailingDays; i++) {
      $container.append($('<div class="calendar-day other-month"></div>').text(i));
    }
  }

  // Deadline rows in the details panel jump to their card (Enter and Space work too)
  $('#calendar-info-box')
    .on('click', '.info-link', function() {
      var $target = $('#' + $(this).data('target'));
      if ($target.length) {
        scrollToElement($target);
        flash($target);
      }
    })
    .on('keydown', '.info-link', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        $(this).trigger('click');
      }
    });

  // ----- Month picker: click the title to jump to any month -----
  var pickerYear = currentMonth.year();
  var $picker = $('#month-picker');

  function renderPicker() {
    var now = moment();
    $('#picker-year').text(pickerYear);
    var $months = $('#picker-months').empty();
    moment.monthsShort().forEach(function(name, m) {
      var $btn = $('<button type="button" class="month-cell"></button>').text(name).attr('data-month', m);
      if (pickerYear === currentMonth.year() && m === currentMonth.month()) $btn.addClass('is-selected');
      if (pickerYear === now.year() && m === now.month()) $btn.addClass('is-today');
      $months.append($btn);
    });
  }

  function setPicker(open) {
    if (open) {
      pickerYear = currentMonth.year();
      renderPicker();
    }
    $picker.prop('hidden', !open);
    $('#calendar-title').attr('aria-expanded', open ? 'true' : 'false');
  }

  function updateTodayButton() {
    $('#today-month').prop('disabled', currentMonth.isSame(moment(), 'month'));
  }

  $('#calendar-title').on('click', function(e) {
    e.stopPropagation();
    setPicker($picker.prop('hidden'));
  });

  $picker.on('click', function(e) { e.stopPropagation(); });
  $('#prev-year').on('click', function() { pickerYear--; renderPicker(); });
  $('#next-year').on('click', function() { pickerYear++; renderPicker(); });

  $('#picker-months').on('click', '.month-cell', function() {
    currentMonth = moment([pickerYear, $(this).data('month'), 1]);
    setPicker(false);
    renderCalendar();
  });

  $('#today-month').on('click', function() {
    currentMonth = moment();
    setPicker(false);
    renderCalendar();
  });

  $(document).on('click', function() { setPicker(false); });
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape' && !$picker.prop('hidden')) {
      setPicker(false);
      $('#calendar-title').trigger('focus');
    }
  });

  $('#prev-month').on('click', function() {
    currentMonth.subtract(1, 'month');
    renderCalendar();
  });

  $('#next-month').on('click', function() {
    currentMonth.add(1, 'month');
    renderCalendar();
  });

  renderCalendar();
});
