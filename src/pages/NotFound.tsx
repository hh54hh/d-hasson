import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
      dir="rtl"
    >
      <div className="text-center p-8">
        <div className="mb-8">
          <AlertTriangle className="h-24 w-24 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            الصفحة غير موجودة
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            عذراً، الصفحة التي تبحث عنها غير متوفرة
          </p>
        </div>

        <Link to="/">
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 text-lg">
            <Home className="h-5 w-5 ml-2" />
            العودة للرئيسية
          </Button>
        </Link>

        <div className="mt-8 text-sm text-gray-500">
          <p>المسار المطلوب: {location.pathname}</p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
