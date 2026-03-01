$ErrorActionPreference = "Continue"
$BASE = "https://flowfy-production.up.railway.app/api"
$PASSED = 0; $FAILED = 0; [System.Collections.ArrayList]$BUGS = @()

function ok($name) { Write-Host "  [PASS] $name" -ForegroundColor Green; $script:PASSED++ }
function fail($name, $msg) { Write-Host "  [FAIL] ${name}: ${msg}" -ForegroundColor Red; $script:FAILED++; $script:BUGS.Add("${name}: ${msg}") | Out-Null }
function section($title) { Write-Host "`n=== $title ===" -ForegroundColor Cyan }
function api($method, $path, $body = $null) {
    $p = @{ Uri = "$script:BASE$path"; Method = $method; Headers = $script:H; ContentType = "application/json"; ErrorAction = "Stop" }
    if ($body) { $p.Body = ($body | ConvertTo-Json -Compress -Depth 5) }
    return Invoke-RestMethod @p
}
section "AUTH"
try {
    $reg = Invoke-RestMethod "$BASE/auth/register" -Method POST -ContentType "application/json" -Body '{"name":"Tester Bot","email":"bot999@flowfy.test","password":"Bot12345!","familyName":"Bot Family"}' -ErrorAction Stop
    ok "Register nuevo usuario"
    $script:H = @{ Authorization = "Bearer $($reg.accessToken)" }; $script:UID = $reg.user.id
} catch {
    $login = Invoke-RestMethod "$BASE/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"bot999@flowfy.test","password":"Bot12345!"}' -ErrorAction Stop
    ok "Register (ya existia, login OK)"
    $script:H = @{ Authorization = "Bearer $($login.accessToken)" }; $script:UID = $login.user.id
}
try { $me = api GET "/auth/me"; if ($me.user.email -eq "bot999@flowfy.test") { ok "GET /auth/me" } else { fail "GET /auth/me" "email incorrecto" } } catch { fail "GET /auth/me" $_.Exception.Message }

section "CATEGORIES"
try { $cats = api GET "/categories"; if ($cats.data.Count -gt 0) { ok "GET /categories ($($cats.data.Count) items)"; $script:CAT_ID = $cats.data[0].id } else { fail "GET /categories" "vacio" } } catch { fail "GET /categories" $_.Exception.Message }

section "TRANSACTIONS"
try { $tx1 = api POST "/transactions" @{ amount=150000; currency="UYU"; description="Sueldo test"; date="2026-03-01T10:00:00.000Z"; type="income"; categoryId=$script:CAT_ID; paymentMethod="transfer" }; if ($tx1.data.id) { ok "POST income ($($tx1.data.amount) centavos)"; $script:TX1_ID = $tx1.data.id } else { fail "POST income" "sin id" } } catch { fail "POST income" $_.Exception.Message }
try { $tx2 = api POST "/transactions" @{ amount=45000; currency="UYU"; description="Supermercado test"; date="2026-03-01T12:00:00.000Z"; type="expense"; categoryId=$script:CAT_ID; paymentMethod="debit" }; if ($tx2.data.id) { ok "POST expense"; $script:TX2_ID = $tx2.data.id } else { fail "POST expense" "sin id" } } catch { fail "POST expense" $_.Exception.Message }
try { $tx3 = api POST "/transactions" @{ amount=30000; currency="UYU"; description="Nafta test"; date="2026-03-02T09:00:00.000Z"; type="expense"; categoryId=$script:CAT_ID; paymentMethod="cash" }; if ($tx3.data.id) { ok "POST expense2"; $script:TX3_ID = $tx3.data.id } else { fail "POST expense2" "sin id" } } catch { fail "POST expense2" $_.Exception.Message }
try { $txList = api GET "/transactions?limit=10"; if ($txList.data.Count -ge 1) { ok "GET /transactions ($($txList.data.Count) items, total=$($txList.meta.total))" } else { fail "GET /transactions" "vacio" } } catch { fail "GET /transactions" $_.Exception.Message }
try { $sum = api GET "/transactions/summary/monthly?month=3&year=2026"; if ($null -ne $sum.data.income) { ok "GET /summary/monthly (income=$($sum.data.income) exp=$($sum.data.expenses) savings=$($sum.data.savings))" } else { fail "GET /summary/monthly" "campos nulos" } } catch { fail "GET /summary/monthly" $_.Exception.Message }
try { $upd = api PATCH "/transactions/$script:TX2_ID" @{ description="Supermercado EDITADO" }; if ($upd.data.description -eq "Supermercado EDITADO") { ok "PATCH /transactions/:id" } else { fail "PATCH /transactions/:id" "desc no cambio: $($upd.data.description)" } } catch { fail "PATCH /transactions/:id" $_.Exception.Message }
try { api DELETE "/transactions/$script:TX3_ID" | Out-Null; ok "DELETE /transactions/:id" } catch { fail "DELETE /transactions/:id" $_.Exception.Message }

section "BUDGETS"
try { $bud = api POST "/budgets" @{ categoryId=$script:CAT_ID; amount=200000; currency="UYU"; month=3; year=2026; rollover=$false }; if ($bud.data.id) { ok "POST /budgets"; $script:BUD_ID = $bud.data.id } else { fail "POST /budgets" "sin id" } } catch { fail "POST /budgets" $_.Exception.Message }
try { $buds = api GET "/budgets?month=3&year=2026"; if ($buds.data.Count -ge 1) { $b=$buds.data[0]; ok "GET /budgets (spent=$($b.spent) pct=$($b.percentage)%)" } else { fail "GET /budgets" "vacio" } } catch { fail "GET /budgets" $_.Exception.Message }
try { api DELETE "/budgets/$script:BUD_ID" | Out-Null; ok "DELETE /budgets/:id" } catch { fail "DELETE /budgets/:id" $_.Exception.Message }

section "GOALS"
try { $goal = api POST "/goals" @{ name="Meta viaje test"; type="savings"; targetAmount=500000; currency="UYU"; targetDate="2026-12-01T00:00:00.000Z"; emoji="plane" }; if ($goal.data.id) { ok "POST /goals"; $script:GOAL_ID = $goal.data.id } else { fail "POST /goals" "sin id" } } catch { fail "POST /goals" $_.Exception.Message }
try { $goals = api GET "/goals"; if ($goals.data.Count -ge 1) { ok "GET /goals ($($goals.data.Count))" } else { fail "GET /goals" "vacio" } } catch { fail "GET /goals" $_.Exception.Message }
try { $c = api PATCH "/goals/$script:GOAL_ID" @{ currentAmount=100000 }; if ($c.data.currentAmount -eq 100000) { ok "PATCH /goals/:id (contribucion)" } else { fail "PATCH /goals/:id" "currentAmount=$($c.data.currentAmount)" } } catch { fail "PATCH /goals/:id" $_.Exception.Message }
try { api DELETE "/goals/$script:GOAL_ID" | Out-Null; ok "DELETE /goals/:id" } catch { fail "DELETE /goals/:id" $_.Exception.Message }

section "FAMILY"
try { $fam = api GET "/family"; if ($fam.data.id) { ok "GET /family (name=$($fam.data.name))" } else { fail "GET /family" "sin id" } } catch { fail "GET /family" $_.Exception.Message }
try { $mb = api GET "/family/members"; if ($mb.data.Count -ge 1) { ok "GET /family/members ($($mb.data.Count))" } else { fail "GET /family/members" "vacio" } } catch { fail "GET /family/members" $_.Exception.Message }
try { $lb = api GET "/family/leaderboard"; if ($lb.data.Count -ge 1) { ok "GET /family/leaderboard ($($lb.data.Count))" } else { fail "GET /family/leaderboard" "vacio" } } catch { fail "GET /family/leaderboard" $_.Exception.Message }
try { $pr = api PATCH "/family/profile" @{ name="Tester Bot Editado" }; if ($pr.data.name -eq "Tester Bot Editado") { ok "PATCH /family/profile" } else { fail "PATCH /family/profile" "name=$($pr.data.name)" } } catch { fail "PATCH /family/profile" $_.Exception.Message }
try { api PATCH "/family/profile" @{ name="Tester Bot" } | Out-Null; ok "PATCH /family/profile (reset)" } catch { fail "PATCH /family/profile reset" $_.Exception.Message }
try { $fu = api PATCH "/family" @{ name="Bot Family Editada" }; if ($fu.data.name -eq "Bot Family Editada") { ok "PATCH /family (nombre)" } else { fail "PATCH /family" "name=$($fu.data.name)" } } catch { fail "PATCH /family" $_.Exception.Message }

section "NOTIFICATIONS"
try { $notifs = api GET "/notifications"; ok "GET /notifications ($($notifs.data.Count) items)"; $script:NOTIF_ID = if ($notifs.data.Count -gt 0) { $notifs.data[0].id } else { $null } } catch { fail "GET /notifications" $_.Exception.Message }
if ($script:NOTIF_ID) { try { $mr = api PATCH "/notifications/$script:NOTIF_ID/read" @{}; if ($mr.success) { ok "PATCH /notifications/:id/read" } else { fail "PATCH notif/read" "success=false" } } catch { fail "PATCH notif/read" $_.Exception.Message } }
try { $mra = api PATCH "/notifications/read-all" @{}; if ($mra.success) { ok "PATCH /notifications/read-all" } else { fail "PATCH notif/read-all" "success=false" } } catch { fail "PATCH notif/read-all" $_.Exception.Message }

section "GAMIFICATION"
try { $gam = api GET "/gamification/my-stats"; ok "GET /gamification/my-stats (xp=$($gam.data.xp) level=$($gam.data.level) streak=$($gam.data.streakDays))" } catch { fail "GET /gamification/my-stats" $_.Exception.Message }
try { $b = api GET "/gamification/badges"; ok "GET /gamification/badges ($($b.data.Count))" } catch { fail "GET /gamification/badges" $_.Exception.Message }

section "AUTH final"
try { $fin = api GET "/auth/me"; ok "GET /auth/me final (xp=$($fin.user.xp) lvl=$($fin.user.level))" } catch { fail "GET /auth/me final" $_.Exception.Message }

Write-Host "`n================================================" -ForegroundColor White
$color = if ($script:FAILED -eq 0) { "Green" } else { "Yellow" }
Write-Host " RESULTADO: $script:PASSED PASS  |  $script:FAILED FAIL" -ForegroundColor $color
if ($script:BUGS.Count -gt 0) { Write-Host "`nBUGS:" -ForegroundColor Red; $script:BUGS | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red } }
Write-Host "================================================`n"
