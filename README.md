# Security and Software Engineering Conference Info

Based on [sec-deadlines](https://sec-deadlines.github.io)

## Website
Visit the service at: [conf.ssp.kr](https://conf.ssp.kr)

## About
- A page to track countdowns for paper submission deadlines of conferences in Security and Software Engineering, which are fields of my interest.
- Provides categorization based on the Impact Factor (IF) of CS conferences from the NRF BK21 Plus project.
  (http://www.kiise.or.kr/TopConferences/data/BK21플러스사업_CS분야_우수국제학술대회목록_2018.pdf)
- The provided information might be inaccurate, so please refer to the official conference website for exact details.

## Adding/Updating Conferences

 - You need to submit a separate Pull Request to add a conference.

### 컨퍼런스 레코드

Example record:

```yaml
- name: S&P (Oakland)
  description: IEEE Symposium on Security and Privacy
  link: https://sp2026.ieee-security.org/
  tags: [SEC, CONF, SEC-TOP, BKIF-4]
  editions:
    - year: 2026
      date: TBA
      deadline:
        - "2025-06-05 23:59"
        - "2025-11-13 23:59"
      place: San Francisco, California, USA
```

Descriptions of the fields (`*` : 필수):

| Field name    | Description                                                                  |
|---------------|------------------------------------------------------------------------------|
| `name`\*      | 컨퍼런스명(약칭)                                                               |
| `description` | 설명                                                                         |
| `link`\*      | 컨퍼런스 URL                                                                |
| `tags`        | 하나 이상의 [태그][3]: `SEC`, `SE` (주제); `BKIF-4` 또는 `BKIF-3` (BKIF)      |
| `editions`\*  | 연도별 컨퍼런스 정보 목록                                                       |

`editions` 배열 내 각 항목:

| Field name    | Description                                                                  |
|---------------|------------------------------------------------------------------------------|
| `year`\*      | 컨퍼런스가 열리는 연도                                                          |
| `date`        | 컨퍼런스가 열리는 날짜                                                          |
| `deadline`\*  | 마감일 목록                                                                   |
| `timezone`    | 타임존 [tz][1] 형식. 기본값은 UTC-12 ([AoE][2])                               |
| `place`       | 컨퍼런스가 열리는 장소                                                          |
| `comment`     | 추가 설명                                                                  |



### Deadline format & Timezones
- 사용자의 타임존에 맞춰 표시됩니다.

[1]: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
[2]: https://www.timeanddate.com/time/zones/aoe
[3]: _data/types.yml


