// Smart Duplicate Customer Detector
import { Customer } from "./types";

export interface DuplicateMatch {
  customer: Customer;
  matchType: "exact_phone" | "exact_name" | "similar_name" | "partial_phone";
  confidence: number; // 0-100
  reason: string;
}

export class DuplicateDetector {
  // Normalize text for comparison
  static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, "ا") // Normalize Arabic alef
      .replace(/[ى��]/g, "ي") // Normalize Arabic yeh
      .replace(/ة/g, "ه") // Normalize Arabic teh marbuta
      .replace(/\s+/g, " "); // Normalize spaces
  }

  // Normalize phone number
  static normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, ""); // Remove spaces, dashes, parentheses
  }

  // Calculate string similarity (simple Levenshtein distance based)
  static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 100;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - distance) / longer.length) * 100;
  }

  // Levenshtein distance algorithm
  static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Find potential duplicates
  static findPotentialDuplicates(
    newCustomer: {
      name: string;
      phone: string;
      address?: string;
    },
    existingCustomers: Customer[],
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    const normalizedNewName = this.normalizeText(newCustomer.name);
    const normalizedNewPhone = this.normalizePhone(newCustomer.phone);

    existingCustomers.forEach((customer) => {
      const normalizedExistingName = this.normalizeText(customer.name);
      const normalizedExistingPhone = this.normalizePhone(customer.phone);

      // Exact phone match
      if (normalizedNewPhone === normalizedExistingPhone) {
        matches.push({
          customer,
          matchType: "exact_phone",
          confidence: 100,
          reason: `نفس رقم الهاتف: ${customer.phone}`,
        });
        return; // Skip other checks for exact phone match
      }

      // Partial phone match (last 8 digits)
      if (
        normalizedNewPhone.length >= 8 &&
        normalizedExistingPhone.length >= 8
      ) {
        const newPhoneLast8 = normalizedNewPhone.slice(-8);
        const existingPhoneLast8 = normalizedExistingPhone.slice(-8);
        if (newPhoneLast8 === existingPhoneLast8) {
          matches.push({
            customer,
            matchType: "partial_phone",
            confidence: 85,
            reason: `تشابه في آخر 8 أرقام من الهاتف`,
          });
        }
      }

      // Exact name match
      if (normalizedNewName === normalizedExistingName) {
        matches.push({
          customer,
          matchType: "exact_name",
          confidence: 95,
          reason: `نفس الاسم بالضبط: ${customer.name}`,
        });
        return;
      }

      // Similar name match
      const nameSimilarity = this.calculateSimilarity(
        normalizedNewName,
        normalizedExistingName,
      );
      if (nameSimilarity >= 80) {
        matches.push({
          customer,
          matchType: "similar_name",
          confidence: nameSimilarity,
          reason: `تشابه في الاسم بنسبة ${Math.round(nameSimilarity)}%`,
        });
      }
    });

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
  }

  // Generate user-friendly warning message
  static generateWarningMessage(
    newCustomer: {
      name: string;
      phone: string;
      address?: string;
    },
    matches: DuplicateMatch[],
  ): {
    title: string;
    message: string;
    suggestions: string[];
  } {
    if (matches.length === 0) {
      return {
        title: "لا توجد تطابقات",
        message: "لم يتم العثور على عملاء مشابهين",
        suggestions: [],
      };
    }

    const highConfidenceMatches = matches.filter((m) => m.confidence >= 90);
    const mediumConfidenceMatches = matches.filter(
      (m) => m.confidence >= 70 && m.confidence < 90,
    );

    let title = "⚠️ تحذير: عملاء مشابهون موجودون!";
    let message = `تم العثور على ${matches.length} عميل مشابه للعميل الجديد:\n\n`;

    message += `👤 العميل الجديد:\n`;
    message += `الاسم: ${newCustomer.name}\n`;
    message += `الهاتف: ${newCustomer.phone}\n`;
    message += `العنوان: ${newCustomer.address || "غير محدد"}\n\n`;

    message += `🔍 العملاء المشابهون:\n\n`;

    matches.slice(0, 3).forEach((match, index) => {
      const confidenceIcon =
        match.confidence >= 95 ? "🔴" : match.confidence >= 80 ? "🟡" : "🟢";

      message += `${confidenceIcon} العميل ${index + 1}:\n`;
      message += `الاسم: ${match.customer.name}\n`;
      message += `الهاتف: ${match.customer.phone}\n`;
      message += `العنوان: ${match.customer.address}\n`;
      message += `السبب: ${match.reason}\n`;
      message += `الدين المستحق: ${match.customer.debtAmount ? `${match.customer.debtAmount.toLocaleString()} د.ع` : "لا يوجد"}\n\n`;
    });

    const suggestions = [];

    if (highConfidenceMatches.length > 0) {
      suggestions.push("تحقق من أن هذا ليس نفس العميل الموجود");
      suggestions.push(
        "قد تحتاج لتحديث بيانات العميل الموجود بدلاً من إنشاء عميل جديد",
      );
    }

    if (mediumConfidenceMatches.length > 0) {
      suggestions.push("راجع البيانات للتأكد من عدم وجود أخطاء إملائية");
      suggestions.push("تأكد من صحة رقم الهاتف");
    }

    suggestions.push("يمكنك المتابعة إذا كنت متأكداً أن هذا عميل جديد مختلف");

    return { title, message, suggestions };
  }

  // Show interactive duplicate warning
  static showDuplicateWarning(
    newCustomer: {
      name: string;
      phone: string;
      address?: string;
    },
    matches: DuplicateMatch[],
  ): Promise<{
    action: "use_existing" | "create_new" | "cancel";
    selectedCustomer?: Customer;
  }> {
    return new Promise((resolve) => {
      if (matches.length === 0) {
        resolve({ action: "create_new" });
        return;
      }

      const warning = this.generateWarningMessage(newCustomer, matches);
      const highConfidenceMatch = matches.find((m) => m.confidence >= 95);

      let confirmMessage = warning.message;
      confirmMessage += `💡 الاقتراحات:\n`;
      confirmMessage += warning.suggestions.map((s) => `• ${s}`).join("\n");
      confirmMessage += `\n\nماذا تريد أن تفعل؟`;

      if (highConfidenceMatch) {
        const useExisting = confirm(
          confirmMessage +
            `\n\n✅ اضغط "موافق" لاستخدام العميل الموجود: ${highConfidenceMatch.customer.name}` +
            `\n❌ اضغط "إلغاء" لإنشاء عميل جديد`,
        );

        if (useExisting) {
          resolve({
            action: "use_existing",
            selectedCustomer: highConfidenceMatch.customer,
          });
        } else {
          resolve({ action: "create_new" });
        }
      } else {
        const proceed = confirm(
          confirmMessage +
            `\n\n✅ اضغط "موافق" للمتابعة وإنشاء عميل جديد` +
            `\n❌ اضغط "إلغاء" للتراجع ومراجعة البيانات`,
        );

        if (proceed) {
          resolve({ action: "create_new" });
        } else {
          resolve({ action: "cancel" });
        }
      }
    });
  }
}
