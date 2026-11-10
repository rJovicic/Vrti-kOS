# Domenski model — nacrt v0.1

**Status:** logički nacrt za raspravu; nije fizička PostgreSQL shema. v0.2 — usklađeno sa specifikacijama 2026-11-10 (`consistency-review.md`, `traceability.md`).  
**Princip:** modelirati stvarne odnose i njihovu vremensku valjanost; ne izvoditi dozvole samo iz UI uloge.

## Glavni agregati

| Agregat | Entiteti | Ključna odgovornost |
|---|---|---|
| Organizacija | organization, location, school_year, group | Struktura vrtića i pedagoške godine |
| Identitet i pristup | auth identity, user_profile, membership, role | Račun, organizacijsko članstvo i uloga |
| Dijete i upis | child, enrollment | Identitet djeteta i vremenski upis u skupinu |
| Skrbništvo | guardianship (sa zastavicama `can_view`, `can_report_absence`, `receives_messages`), access_restriction | Odnos skrbnika i djeteta, dozvole i ograničenja (DD-02; zaseban `guardianship_permission` tek ako katalog zastavica naraste) |
| Preuzimanje | pickup_person, pickup_authorization | Osoba i vremenski opseg ovlaštenja za preuzimanje |
| Djelatnici | staff_assignment (`assignment_type ∈ {regular, substitute}`, `approved_by`) | Vremenski raspored djelatnika; zamjena je vrsta rasporeda (DD-01) |
| Dolasci | attendance_event, attendance_correction, absence_report | Evidencija događaja, korekcije i izostanci |
| Dnevni sadržaj | daily_report (po skupini i danu, A-05), activity_tag, menu, event | Objavljeni sadržaj s autorom i publikom |
| Komunikacija | announcement, announcement_revision, conversation (po djetetu, A-07), conversation_participant (izveden iz odnosa), message | Obavijesti s poviješću verzija i razgovori |
| Mediji i privole | media_asset, media_child_link, consent_type, consent_record | Privatna pohrana, poveznice na djecu i dokaz privole |
| Operacije | audit_log, invitation, notice_acknowledgment, device_token, notification_preference, notification_outbox, organization_settings | Revizija, pozivnice, potvrde obavijesti o privatnosti, uređaji, postavke i pouzdana dostava |
| Prava ispitanika | data_subject_request, retention_rule | Evidencija zahtjeva i rokovi čuvanja po kategoriji podataka i organizaciji (FS-15) |

## Ključne veze
- Organization 1:N Location, Membership, SchoolYear, Child, Invitation.
- Location 1:N Group; SchoolYear 1:N Group.
- UserProfile 1:N Membership, Guardianship, DeviceToken.
- Child 1:N Enrollment, Guardianship, PickupAuthorization, AttendanceEvent, AbsenceReport, ConsentRecord.
- Group 1:N Enrollment, StaffAssignment, Announcement.
- Conversation N:M UserProfile preko ConversationParticipant; razgovor ima Organization.
- MediaAsset N:M Child preko MediaChildLink.
- ConsentRecord referencira dijete, vrstu/svrhu privole, verziju teksta i osobu koja je zabilježila odluku.

## Obvezni atributi / ograničenja
- Svaki tenant-owned red ima `organization_id`; gdje je moguće, kompozitni FK osigurava da reference pripadaju istoj organizaciji.
- Svaka vremenska veza ima `valid_from`, `valid_to` (poluotvoreni interval [from, to)) i status.
- Vrijeme događaja: `occurred_at` (UTC), `recorded_at` (UTC), `recorded_by`, `source`, `idempotency_key`.
- Događaji koji se ispravljaju ostaju nepromjenjivi; korekcija referencira izvor.
- PII polja i posebne kategorije podataka klasificiraju se zasebno.
- Brisanje/anonimizacija mora biti definirano retencijskom politikom, ne generičkim cascade deleteom.
- Ne koristiti email kao trajni identifikator korisnika ili skrbnika.
- Ne koristiti naziv skupine ili ulogu kao sigurnosni dokaz.

## Razriješeno u v0.2 (prijedlozi za pregled vlasnika)
- Zamjena = vrsta rasporeda (DD-01). Zastavice na skrbničkoj vezi, ograničenje kao zaseban entitet (DD-02).
- Preuzimanje: `pickup_person` + `pickup_authorization` po djetetu (DD-03).
- Dolazak i predaja su jedan `attendance_event` s opcionalnom referencom na osobu s popisa (DD-07) — odgovor na pitanje 6 niže.
- Skrbnik ima članstvo i skrbničku vezu (DD-08). Pozivnice samo e-poštom (DD-06) — odgovor na pitanje 2.
- Dnevni pregled po skupini (A-05) i razgovor po djetetu (A-07) — prijedlozi za pitanja 4 i 5, ovise o validaciji.

## Otvorene modelne odluke
1. Dijete kao jedinstveni identitet kroz više vrtića ili odvojeni zapis po organizaciji? Prednost za MVP: organizacijski izoliran zapis; međuvrtićno povezivanje samo uz dokazanu potrebu.
2. Jesu li roditelji/skrbioci pozvani po e-mailu, SMS-u ili kroz identifikaciju vrtića?
3. Je li skrbnička veza unesena u sustav kao potvrđena ili čeka provjeru?
4. Treba li dnevni izvještaj biti po djetetu ili skupini?
5. Razgovor je li vezan uz dijete, skupinu ili organizaciju?
6. Je li evidencija dolaska odvojena od evidencije predaje/preuzimanja?
7. Kako modelirati više djece u različitim organizacijama uz jedan korisnički račun bez spajanja njihovih tenant podataka?

## Napomena o privatnosti
Model ne uključuje zdravstvene profile, dijagnoze, lijekove, razvojne procjene, biometriju ni automatsko zaključivanje o djetetu. Njihovo uvođenje zahtijeva zasebnu svrhu, pravnu osnovu, pristup, rok čuvanja, DPIA procjenu i odobrenje.