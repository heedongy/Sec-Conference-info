---
---
$(function() {
  deadlineByConf = {};

  {% for conf in site.data.conferences %}
  // {{ conf.name }} {{ conf.year }}
  {% if conf.deadline[0] == "TBA" %}
  {% assign conf_id = conf.name | append: conf.year | append: '-0' | slugify %}
  $('#{{ conf_id }} .timer').html("TBA");
  $('#{{ conf_id }} .deadline-time').html("TBA");
  deadlineByConf["{{ conf_id }}"] = null;

  {% else %}
  var rawDeadlines = {{ conf.deadline | jsonify }} || [];
  if (rawDeadlines.constructor !== Array) {
    rawDeadlines = [rawDeadlines];
  }
  var parsedDeadlines = [];
  while (rawDeadlines.length > 0) {
    var rawDeadline = rawDeadlines.pop();
    // deal with year template in deadline
    year = {{ conf.year }};
    rawDeadline = rawDeadline.replace('%y', year).replace('%Y', year - 1);
    // adjust date according to deadline timezone
    {% if conf.timezone %}
    var deadline = moment.tz(rawDeadline, "{{ conf.timezone }}");
    {% else %}
    var deadline = moment.tz(rawDeadline, "Etc/GMT+12"); // Anywhere on Earth
    {% endif %}

    // post-process date
    if (deadline.minutes() === 0) {
      deadline.subtract(1, 'seconds');
    }
    if (deadline.minutes() === 59) {
      deadline.seconds(59);
    }
    parsedDeadlines.push(deadline);
  }
  // due to pop before; we need to reverse such that the i index later matches
  // the right parsed deadline
  parsedDeadlines.reverse();

  {% assign range_end = conf.deadline.size | minus: 1 %}
  {% for i in (0..range_end) %}
  {% assign conf_id = conf.name | append: conf.year | append: '-' | append: i | slugify %}
  var deadlineId = {{ i }};
  if (deadlineId < parsedDeadlines.length) {
    var confDeadline = parsedDeadlines[deadlineId];

    // render countdown timer
    if (confDeadline) {
      function make_update_countdown_fn(confDeadline) {
        return function(event) {
          diff = moment() - confDeadline
          if (diff <= 0) {
             $(this).html(event.strftime('%D days %Hh %Mm %Ss'));
          } else {
            $(this).html(confDeadline.fromNow());
          }
        }
      }
      $('#{{ conf_id }} .timer').countdown(confDeadline.toDate(), make_update_countdown_fn(confDeadline));
      // check if date has passed, add 'past' class to it
      if (moment() - confDeadline > 0) {
        $('#{{ conf_id }}').addClass('past');
      }
      $('#{{ conf_id }} .deadline-time').html(confDeadline.local().format('D MMM YYYY, h:mm:ss a'));
      deadlineByConf["{{ conf_id }}"] = confDeadline;
    }
  } else {
    // TODO: hide the conf_id ?
  }
  {% endfor %}
  {% endif %}
  {% endfor %}

  // Reorder list
  var today = moment();
  var confs = $('.conf').detach();
  confs.sort(function(a, b) {
    var aDeadline = deadlineByConf[a.id];
    var bDeadline = deadlineByConf[b.id];
    var aDiff = today.diff(aDeadline);
    var bDiff = today.diff(bDeadline);
    if (aDiff < 0 && bDiff > 0) {
      return -1;
    }
    if (aDiff > 0 && bDiff < 0) {
      return 1;
    }
    return bDiff - aDiff;
  });
  $('.conf-container').append(confs);

  // Filter state management
  var filterState = {
    field: 'ALL',
    topconf: 'ALL',
    bkif: [],
    conftype: 'ALL'
  };

  // Load saved state
  var savedState = store.get('{{ site.domain }}_filter_v3');
  if (savedState) {
    filterState = savedState;
    if (!Array.isArray(filterState.bkif)) {
      filterState.bkif = [];
    }
    if (filterState.field !== 'ALL') {
      $('#' + filterState.field + '-radio').prop('checked', true);
    } else {
      $('#ALL-radio').prop('checked', true);
    }
    if (filterState.topconf === 'YES') {
      $('#TOP-YES-radio').prop('checked', true);
    } else {
      $('#TOP-ALL-radio').prop('checked', true);
    }
    // Restore BK21-IF checkbox state
    filterState.bkif.forEach(function(bk) {
      $('#' + bk + '-checkbox').prop('checked', true);
    });
    if (filterState.conftype !== 'ALL') {
      $('#' + filterState.conftype + '-radio').prop('checked', true);
    } else {
      $('#TYPE-ALL-radio').prop('checked', true);
    }
  }

  function update_conf_list() {
    confs.each(function(i, conf) {
      var $conf = $(conf);
      var show = true;

      // 1. Field filter (SEC or SE)
      if (filterState.field !== 'ALL') {
        if (!$conf.hasClass(filterState.field)) {
          show = false;
        }
      }

      // 2. Top Conference filter
      if (show && filterState.topconf === 'YES') {
        // Check the TOP tag for the selected field
        if (filterState.field === 'SEC') {
          if (!$conf.hasClass('SEC-TOP')) {
            show = false;
          }
        } else if (filterState.field === 'SE') {
          if (!$conf.hasClass('SE-TOP')) {
            show = false;
          }
        } else {
          // If all fields are selected, show if it has SEC-TOP or SE-TOP
          if (!$conf.hasClass('SEC-TOP') && !$conf.hasClass('SE-TOP')) {
            show = false;
          }
        }
      }

      // 3. BK21-IF filter (show if matches any selected)
      if (show && filterState.bkif.length > 0) {
        var hasBkif = false;
        for (var j = 0; j < filterState.bkif.length; j++) {
          if ($conf.hasClass(filterState.bkif[j])) {
            hasBkif = true;
            break;
          }
        }
        if (!hasBkif) {
          show = false;
        }
      }

      // 4. Type filter (CONF or SHOP)
      if (show && filterState.conftype !== 'ALL') {
        if (!$conf.hasClass(filterState.conftype)) {
          show = false;
        }
      }

      if (show) {
        $conf.show();
      } else {
        $conf.hide();
      }
    });
  }
  update_conf_list();

  // Field radio button event
  $('.field-radio').change(function(e) {
    filterState.field = $(this).val();
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // Top Conference radio button event
  $('.top-radio').change(function(e) {
    filterState.topconf = $(this).val();
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // BK21-IF checkbox event
  $('.bkif-checkbox').change(function(e) {
    var val = $(this).val();
    var checked = $(this).is(':checked');
    if (checked) {
      if (filterState.bkif.indexOf(val) === -1) {
        filterState.bkif.push(val);
      }
    } else {
      var idx = filterState.bkif.indexOf(val);
      if (idx !== -1) {
        filterState.bkif.splice(idx, 1);
      }
    }
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // Type radio button event
  $('.type-radio').change(function(e) {
    filterState.conftype = $(this).val();
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });
