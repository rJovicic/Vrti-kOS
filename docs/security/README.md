# Sigurnost

Faza 2 (ograničeni opseg) — nacrti, ništa nije implementirano. Pretpostavlja predloženu arhitekturu (ADR-0003…0008, nisu odobreni).

| Dokument | Sadržaj |
|---|---|
| [threat-model.md](threat-model.md) | Imovina, akteri, granice povjerenja, STRIDE po komponenti (T-xx), preostali rizici |
| [security-requirements.md](security-requirements.md) | Sigurnosni zahtjevi SR-xx s prioritetima i poveznicama na FR, dozvole, podatke i rizike; obvezni negativni testovi NEG-01…15 |
| [security-test-plan.md](security-test-plan.md) | Testni scenariji ST-xx (RLS, Alfa/Beta, skrbnici, odgojitelji, opoziv, Storage, privilegirani računi, audit) |
| [incident-response-plan.md](incident-response-plan.md) | Detekcija, razine SEV-1…4, uloge, playbookovi P-01…P-10, dokazi, obnova, komunikacija s vrtićem |

Planirano: detaljna ASVS L2 / MASVS kontrolna lista (backlog P2-20).
Temeljne odluke: [../decisions/](../decisions/) (0004, 0005, 0007, 0008); rizici: [../risks.md](../risks.md).
