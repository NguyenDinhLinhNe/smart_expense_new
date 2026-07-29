import React, { useEffect } from 'react';

const SEO = ({ 
  title = "Smart Expense Tracker - Nền Tảng Quản Lý Chi Tiêu & Tài Chính AI Thông Minh",
  description = "Ứng dụng quản lý tài chính cá nhân thế hệ mới tích hợp Trí tuệ nhân tạo AI Advisor, tự động lập ngân sách, quét hóa đơn thông minh và phân tích chi tiêu chuyên nghiệp.",
  keywords = "quản lý chi tiêu, sổ thu chi, tài chính cá nhân, trợ lý AI tài chính, ngân sách thông minh, Smart Expense Tracker",
  url = window.location.href,
  image = "/favicon.ico" 
}) => {
  useEffect(() => {
    // Update Title
    document.title = title;

    // Update Meta Description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      metaDescription.content = description;
      document.head.appendChild(metaDescription);
    }

    // Update Meta Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', keywords);
    } else {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      metaKeywords.content = keywords;
      document.head.appendChild(metaKeywords);
    }

    // Update Open Graph (OG) Tags for Social Media (FB, Zalo, LinkedIn)
    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: image }
    ];

    ogTags.forEach(({ property, content }) => {
      let ogMeta = document.querySelector(`meta[property="${property}"]`);
      if (ogMeta) {
        ogMeta.setAttribute('content', content);
      } else {
        ogMeta = document.createElement('meta');
        ogMeta.setAttribute('property', property);
        ogMeta.setAttribute('content', content);
        document.head.appendChild(ogMeta);
      }
    });

    // Add Schema.org JSON-LD Structured Data for Google
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Smart Expense Tracker",
      "operatingSystem": "All",
      "applicationCategory": "FinanceApplication",
      "description": description,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "VND"
      }
    };

    let scriptSchema = document.querySelector('#seo-schema-jsonld');
    if (!scriptSchema) {
      scriptSchema = document.createElement('script');
      scriptSchema.id = 'seo-schema-jsonld';
      scriptSchema.type = 'application/ld+json';
      document.head.appendChild(scriptSchema);
    }
    scriptSchema.text = JSON.stringify(schemaData);

  }, [title, description, keywords, url, image]);

  return null;
};

export default SEO;
