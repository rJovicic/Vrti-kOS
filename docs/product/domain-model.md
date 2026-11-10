# Domenski model — nacrt v0.1

**Status:** logički nacrt za raspravu; nije fizička PostgreSQL shema.  
**Princip:** modelirati stvarne odnose i njihovu vremensku valjanost; ne izvoditi dozvole samo iz UI uloge.

## Glavni agregati

| Agregat | Entiteti | Ključna odgovornost |
|---|---|---|
| Organizacija | organization, location, school_year, group | Struktura vrtića i pedagoške godine |
| Identitet i pristup | auth identity, user_profile, membership, role | Račun, organizacijsko članstvo i uloga |
| Dijete i upis | child, enrollment | Identitet djeteta i vremenski upis u skupinu |
| Skrbništvo | guardianship, guardianship_permission, access_restriction | Odnos skrbnika i djeteta, pojedinačne dozvole i ograničenja |
| Preuzimanje | pickup_person, pickup_authorization | Osoba i vremenski opseg ovlaštenja za preuzimanje |
| Djelatnici | staff_assignment, substitute_assignment | Vremenski raspored djelatnika i zamjena |
| Dolasci | attendance_event, attendance_correction, absence_report | Evidencija događaja, korekcije i izostanci |
| Dnevni sadržaj | daily_report, activity, menu | Objavljeni sadržaj s autorom i publikom |
| Komunikacija | announcement, conversation, conversation_participant, message | Obavijesti i razgovori s eksplicitnim sudionicima |
| Mediji i privole | media_asset, media_child_link, consent_type, consent_record | Privatna pohrana, poveznice na djecu i dokaz privole |
| Operacije | audit_log, invitation, device_token, notification_outbox | Revizija, pozivnice, uređaji i pouzdana dostava |

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