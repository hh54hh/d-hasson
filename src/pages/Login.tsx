import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Package, Lock } from "lucide-react";
import { authenticate, isAuthenticated } from "@/lib/storage";
import { cn } from "@/lib/utils";

const Login: React.FC = () => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication status only once on mount
    const checkAuth = () => {
      if (isAuthenticated()) {
        navigate("/", { replace: true });
      }
    };

    // Small delay to prevent race conditions
    const timeoutId = setTimeout(checkAuth, 100);

    return () => clearTimeout(timeoutId);
  }, []); // Remove navigate dependency to prevent re-running

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate loading for better UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (authenticate(code)) {
      navigate("/");
    } else {
      setError("رمز الدخول غير صحيح");
      setCode("");
    }

    setIsLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full mb-4 shadow-lg">
            <Package className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">PAW</h1>
          <p className="text-gray-600">نظام إدارة مخزن الهواتف</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full mb-4 mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl text-gray-800">
              تسجيل الدخول
            </CardTitle>
            <CardDescription className="text-gray-600">
              أدخل رمز الدخول للوصول إلى النظام
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="code"
                  className="text-sm font-medium text-gray-700"
                >
                  رمز الدخول
                </label>
                <Input
                  id="code"
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="أدخل رمز الدخول"
                  className={cn(
                    "text-center text-lg font-mono tracking-wider h-12",
                    error && "border-red-500 focus-visible:ring-red-500",
                  )}
                  disabled={isLoading}
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-600 text-center mt-2">
                    {error}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
                disabled={isLoading || !code.trim()}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري التحقق...</span>
                  </div>
                ) : (
                  "دخول"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>© 2024 PAW - نظام إدارة مخزن الهواتف</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
