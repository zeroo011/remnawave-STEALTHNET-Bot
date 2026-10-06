import { useEffect, useState } from "react";
import { Sparkles, Clock, Save, History, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth";

interface SectorItem {
  id: string;
  type: string;
  value: number;
  label: string;
  weight: number;
  color: string;
  icon?: string;
}

export function RouletteAdminTab() {
  const { state } = useAuth();
  const token = state.accessToken;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [totalSpins, setTotalSpins] = useState(0);
  const [spinsByType, setSpinsByType] = useState<any[]>([]);
  const [recentSpins, setRecentSpins] = useState<any[]>([]);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.getAdminRoulette(token);
      if (res) {
        setEnabled(res.settings?.enabled ?? true);
        setCooldownHours(res.settings?.cooldownHours ?? 24);
        setSectors(res.settings?.sectors ?? []);
        setTotalSpins(res.totalSpins ?? 0);
        setSpinsByType(res.spinsByType ?? []);
        setRecentSpins(res.recentSpins ?? []);
      }
    } catch (e: any) {
      toast.error("Ошибка", e?.message || "Не удалось загрузить настройки рулетки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    try {
      setSaving(true);
      await api.updateAdminRoulette(token, {
        enabled,
        cooldownHours,
        sectors,
      });
      toast.success("Сохранено", "Настройки рулетки успешно обновлены");
      loadData();
    } catch (e: any) {
      toast.error("Ошибка сохранения", e?.message || "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  const updateSectorWeight = (index: number, weight: number) => {
    setSectors((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], weight: Math.max(0, weight) };
      return copy;
    });
  };

  const updateSectorLabel = (index: number, label: string) => {
    setSectors((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], label };
      return copy;
    });
  };

  const totalWeight = sectors.reduce((acc, s) => acc + (s.weight || 0), 0);

  if (loading) {
    return (
      <Card className="overflow-hidden border-border p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Загрузка рулетки…</span>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border">
      <div className="relative bg-muted p-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Рулетка удачи (Колесо фортуны)
            </h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              Управление ежедневными подарками, кулдауном и секторами рулетки
            </p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-6 p-4 sm:p-6">
        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="text-xs text-muted-foreground font-medium">Всего вращений</div>
            <div className="text-2xl font-black mt-1 text-foreground">{totalSpins}</div>
          </div>
          {spinsByType.map((st) => (
            <div key={st.rewardType} className="p-3.5 rounded-xl bg-muted/40 border border-border">
              <div className="text-xs text-muted-foreground font-medium capitalize">
                {st.rewardType === "days"
                  ? "Дни подписки"
                  : st.rewardType === "balance"
                  ? "Рубли (баланс)"
                  : st.rewardType === "traffic"
                  ? "ГБ трафика"
                  : st.rewardType === "discount"
                  ? "Скидки"
                  : "Пустые секторы"}
              </div>
              <div className="text-xl font-bold mt-1 text-foreground">
                {st._count?.id || 0}{" "}
                <span className="text-xs font-normal text-muted-foreground">раз</span>
              </div>
            </div>
          ))}
        </div>

        {/* Основные параметры */}
        <div className="space-y-4 rounded-xl border border-border p-4 bg-card/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold cursor-pointer" htmlFor="roulette-enabled-switch">
                Включить рулетку
              </Label>
              <p className="text-xs text-muted-foreground">
                Доступность рулетки в Mini App (Aurora и Stealth) и Telegram-боте
              </p>
            </div>
            <Switch
              id="roulette-enabled-switch"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="cooldown-input">Кулдаун между вращениями (часы)</Label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="cooldown-input"
                  type="number"
                  min={1}
                  max={720}
                  value={cooldownHours}
                  onChange={(e) => setCooldownHours(parseInt(e.target.value, 10) || 24)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                По умолчанию 24 часа (одно бесплатное вращение в сутки).
              </p>
            </div>
          </div>
        </div>

        {/* Настройка секторов */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Секторы и вероятности</h3>
              <p className="text-xs text-muted-foreground">
                Шанс каждого сектора рассчитывается пропорционально его весу (сумма весов: {totalWeight}).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {sectors.map((sec, idx) => {
              const pct = totalWeight > 0 ? ((sec.weight / totalWeight) * 100).toFixed(1) : "0";
              return (
                <div key={sec.id} className="p-3 bg-card/60 flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: sec.color }}
                  />
                  <div className="flex-1 min-w-[140px]">
                    <Input
                      value={sec.label}
                      onChange={(e) => updateSectorLabel(idx, e.target.value)}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div className="w-24 text-xs font-mono text-muted-foreground shrink-0">
                    Тип: {sec.type}
                  </div>
                  <div className="flex items-center gap-2 w-32 shrink-0">
                    <span className="text-xs text-muted-foreground">Вес:</span>
                    <Input
                      type="number"
                      min={0}
                      value={sec.weight}
                      onChange={(e) => updateSectorWeight(idx, parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs w-16"
                    />
                  </div>
                  <div className="w-16 text-right font-mono font-bold text-xs text-primary shrink-0">
                    ~{pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Кнопка сохранения */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить настройки рулетки
          </Button>
        </div>

        {/* Последние 10 выигрышей */}
        {recentSpins.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Последние вращения пользователей</h3>
            </div>
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-2.5">Клиент</th>
                    <th className="p-2.5">Приз</th>
                    <th className="p-2.5">Тип</th>
                    <th className="p-2.5">Дата и время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentSpins.slice(0, 10).map((sp) => (
                    <tr key={sp.id} className="hover:bg-muted/30">
                      <td className="p-2.5 font-medium">
                        {sp.client?.telegramUsername
                          ? `@${sp.client.telegramUsername}`
                          : sp.client?.email || sp.clientId?.slice(0, 8)}
                      </td>
                      <td className="p-2.5 font-bold">{sp.rewardLabel}</td>
                      <td className="p-2.5 capitalize text-muted-foreground">{sp.rewardType}</td>
                      <td className="p-2.5 text-muted-foreground font-mono">
                        {new Date(sp.createdAt).toLocaleString("ru-RU")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
