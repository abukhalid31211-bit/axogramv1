import { useState } from "react";
import { LogOut } from "lucide-react";
import { useNav } from "../nav";
import { PageHeader, Button } from "../ui";

export function ExitScreen() {
  const { home } = useNav();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="animate-fade">
      <PageHeader title="خروج" icon={<LogOut className="h-5 w-5" />} />
      <div className="mx-auto max-w-md card p-8 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-danger-50 text-danger-500 ring-2 ring-danger-200">
          <LogOut className="h-8 w-8" />
        </div>
        {!confirm ? (
          <>
            <h3 className="text-lg font-bold text-surface-800">هل تريد الخروج؟</h3>
            <p className="mt-1 text-sm text-surface-500">سيتم إنهاء الجلسة الحالية.</p>
            <div className="mt-6 flex gap-2">
              <Button variant="danger" className="flex-1" onClick={() => setConfirm(true)}>تأكيد الخروج</Button>
              <Button className="flex-1" onClick={home}>البقاء</Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-surface-800">تم تسجيل الخروج</h3>
            <p className="mt-1 text-sm text-surface-500">شكراً لاستخدام Axogram Pro.</p>
            <div className="mt-6">
              <Button variant="primary" className="w-full" onClick={home}>العودة للرئيسية</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
