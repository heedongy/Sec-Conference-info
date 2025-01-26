# Security and Software Engineering Conference Info

Based on [sec-deadlines](https://sec-deadlines.github.io) by Bogdan Kulynych

## Website
Visit the service at: [conf.ssp.kr](https://conf.ssp.kr)

## 소개
- 그저 제가 관심 있는 보안 및 소프트웨어 공학 분야의 컨퍼런스의 논문 제출 마감일 카운트다운 정보를 확인하기 위한 페이지입니다.
- 한국연구재단 BK21 플러스 사업 CS 컨퍼런스의 IF에 따라 분류도 제공합니다.
 (http://www.kiise.or.kr/TopConferences/data/BK21플러스사업_CS분야_우수국제학술대회목록_2018.pdf)
- 제공되는 정보는 사실과 다를 수 있으며, 정확한 정보는 컨퍼런스 홈페이지를 참고해야 합니다.

## 컨퍼런스 추가/업데이트

 - [sec-deadlines](https://sec-deadlines.github.io)와 같이 _data/conferences.yml 파일을 그대로 사용하지만, 따로 관리하므로 추가를 위해서는 따로 Pull Request를 보내야 합니다.

### 컨퍼런스 레코드

Example record:

```
- name: S&P (Oakland)
  year: 2026
  date: TBA
  description: IEEE Symposium on Security and Privacy
  link: https://sp2026.ieee-security.org/
  deadline:
    - "2025-06-05 23:59"
    - "2025-11-13 23:59"
  place: San Francisco, California, USA
  tags: [SEC, CONF, SEC-TOP, BKIF-4]
```

Descriptions of the fields (`*` : 필수):

| Field name    | Description                                                                  |
|---------------|------------------------------------------------------------------------------|
| `name`\*      | 컨퍼런스명(약칭)                                                               |
| `year`\*      | 컨퍼런스가 열리는 연도                                                          |
| `description` | 설명                                                                         |
| `comment`     | 추가 설명                                                                  |
| `link`\*      | 컨퍼런스 URL                                                                |
| `deadline`\*  | 마감일 목록                                                                   |
| `timezone`    | 타임존 [tz][1] 형식. 기본값은 UTC-12 ([AoE][2])                               |
| `date`        | 컨퍼런스가 열리는 날짜                                                          |
| `place`       | 컨퍼런스가 열리는 장소                                                          |
| `tags`        | 하나 이상의 [태그][3]: `SEC`, `SE` (주제); `BKIF-4` 또는 `BKIF-3` (BKIF)      |



### Deadline format & Timezones

- [sec-deadlines](https://sec-deadlines.github.io) 와 같은 형식을 사용합니다.
- 사용자의 타임존에 맞춰 표시됩니다.

[1]: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
[2]: https://www.timeanddate.com/time/zones/aoe
[3]: _data/types.yml


