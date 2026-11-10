# Sljedivost i provjera usklađenosti specifikacija

**Datum:** 2026-11-10 · **Svrha:** svaka MVP funkcija mora imati korisnika, dozvolu, entitet, kriterij prihvaćanja i
redak inventara podataka. Ova tablica kasnije postaje izvor za generiranje testova autorizacije (P1-2 kriterij).

## 1. Matrica sljedivosti

| FS | Prioritet | Uloge (matrica §4) | Dozvole (katalog §7) | Entiteti (domenski model) | AC | Podaci (DI) | Otvoreno |
|---|---|---|---|---|---|---|---|
| FS-01 | Must | sve | `membership.manage`, vlastiti račun | user_profile, membership, invitation, device_token, notice_acknowledgment | AC-01-1…8 | DI-01, 02, 03, 05, 06 | Q-T03, Q-T10, Q-T11, Q-P05 |
| FS-02 | Must | platform admin, uprava | `organization.manage`, `organization.read`, `location.manage`, `school_year.manage`, `group.manage`, `group.read` | organization, location, school_year, group | AC-02-1…4 | DI-08 | Q-T12 |
| FS-03 | Must | uprava, odgojitelj | `membership.manage`, `staff_assignment.manage` | membership, staff_assignment (`assignment_type`) | AC-03-1…5 | DI-02, 03, 04 | Q-T09 |
| FS-04 | Must | uprava, skrbnik, odgojitelj | `child.read/manage`, `enrollment.manage`, `guardianship.read/manage`, `pickup_person.read/manage` | child, enrollment, guardianship, access_restriction, pickup_person, pickup_authorization | AC-04-1…8 | DI-09…13 | Q-P03, Q-P11, Q-T04, Q-T13 |
| FS-05 | Must | odgojitelj, uprava, skrbnik | `attendance.record/correct/read` | attendance_event, attendance_correction | AC-05-1…8 | DI-14, 15 | H-03, H-05, matrica §9 (ispravci) |
| FS-06 | Must | skrbnik, odgojitelj, uprava | `absence.report/read/manage` | absence_report, organization_settings | AC-06-1…6 | DI-16 | Q-P16, Q-T14, H-04 |
| FS-07 | Must | uprava, (odgojitelj), skrbnik | `announcement.publish/read` | announcement, announcement_revision | AC-07-1…5 | DI-17 | Q-T15, matrica *** |
| FS-08 | Must | sve | vlastite postavke | device_token, notification_preference, notification_outbox, organization_settings | AC-08-1…3 | DI-07 | Q-T05 |
| FS-09 | Must | uprava, platform admin | `audit.read`, `membership.manage` | audit_log | AC-09-1…3 | DI-22 | Q-S06, Q-P09 |
| FS-10 | Should | odgojitelj, skrbnik | `daily_report.write/read` | daily_report, activity_tag | AC-10-1…2 | DI-18 | H-06 |
| FS-11 | Should | skrbnik, odgojitelj | `conversation.read/send/manage` | conversation, conversation_participant (izveden), message | AC-11-1…3 | DI-19 | D-10, Q-T05, Q-T16 |
| FS-12 | Should | uprava, svi | `menu.publish/read` | menu | AC-12-1 | DI-20 | — |
| FS-13 | Should | uprava, svi | `event.manage/read` | event | AC-13-1 | DI-21 | — |
| FS-14 | Should | uprava | `report.read` (`report.export` kasnije) | — (upiti nad attendance/absence) | AC-14-1…2 | DI-14, 16 | — |
| FS-15 | Must (produkcija) | uprava, platform tim | `dsr.manage`, `retention.manage` | data_subject_request, retention_rule | AC-15-1…4 | DI-23, sve s rokom | Q-P09, Q-P10 |

## 2. Postupak provjere
1. Svaki ključ dozvole iz specifikacija postoji u katalogu `roles-and-permissions.md` §7.
2. Svaki entitet iz specifikacija postoji u `domain-model.md`.
3. Svaki FS u MVP-u postoji u `mvp-scope.md` s istim prioritetom, i obrnuto.
4. Svaki FR ima barem jedan AC (osim čisto informativnih zahtjeva koji su pokriveni općim pravilima).
5. Svaki podatak iz specifikacija postoji u inventaru; nijedan isključeni podatak (DI-F1…F7) nije u specifikacijama.
6. Nema zdravstvenih podataka, biometrije, prepoznavanja lica ni AI analize u specifikacijama MVP-a.

## 3. Rezultat provjere (2026-11-10)

Automatizirana provjera (linkovi, definicije svih ID-ova Q/R/D/DD/A/H/DI/FR/N, katalog dozvola, entiteti, broj stupaca
tablica, FR → AC) prolazi bez grešaka. Skripta se trenutno pokreće izvan repozitorija (backlog P1-14).

| # | Provjera | Nalaz | Akcija |
|---|---|---|---|
| 1 | Dozvole | Nedostajali su `location.read/manage`, `school_year.manage`, `event.read/manage`, `dsr.manage`, `retention.manage`. | Dodani u katalog i matricu. |
| 2 | Entiteti | Nedostajali su `notice_acknowledgment`, `announcement_revision`, `notification_preference`, `organization_settings`, `activity_tag`, `data_subject_request`, `retention_rule`; `substitute_assignment` i `guardianship_permission` zamijenjeni (DD-01, DD-02). | Domenski model ažuriran. |
| 3 | MVP opseg | Jelovnik bio uvjetni Must (N-11); FS-15 i FS-08 nisu bili eksplicitno navedeni. | `mvp-scope.md` ažuriran. |
| 4 | FR → AC | 94 FR-a, 63 AC-a. 20 FR-ova nema zaseban AC: FR-01-7, FR-01-10, FR-02-2, FR-02-4, FR-03-1, FR-04-10, FR-08-1, FR-08-3, FR-09-5, FR-10-2, FR-10-4, FR-10-5, FR-11-3, FR-11-5, FR-11-7, FR-12-1, FR-12-4, FR-13-2, FR-13-3, FR-14-2 (pretežno CRUD/informativni ili Should moduli koji ovise o validaciji). Dodani AC-03-5, AC-04-8, AC-05-8, AC-06-6, AC-07-5, AC-15-4 za važnije zahtjeve. | Dopuniti prije Faze 3 — backlog P1-11. |
| 5 | Inventar | Svi podaci iz FS imaju DI redak; DI-F1…F7 se ne pojavljuju u Must/Should zahtjevima. | — |
| 6 | Zabranjene kategorije | Nema zdravstvenih podataka, biometrije ni AI analize. Rizične točke: slobodni tekst u FS-07, FS-10, FS-11 (ublaženo upozorenjem autoru, bez automatske analize). | R-20 ostaje otvoren. |
| 7 | Proturječje | FR-07-3 (verzije u auditu) vs. FR-09-2 (audit bez sadržaja). | Razriješeno: `announcement_revision`. |
| 8 | Uloge | Specifikacije koriste samo MVP uloge (DD-05). Ćelije "Otvoreno" u matrici tretiraju se kao "Ne" (FR-06-7 za odgojitelja, FR-07-1 za odgojitelja). | — |
