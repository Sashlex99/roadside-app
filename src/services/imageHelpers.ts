import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Компресира изображение за да се вмести в Firestore (под 800KB)
 * @param uri - URI на оригиналното изображение
 * @returns URI на компресираното изображение
 */
const compressImage = async (uri: string): Promise<string> => {
  try {
    console.log('🔄 Compressing image...');
    
    // First compression - reasonable quality but smaller size
    const firstCompression = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: 800 } }, // Max 800px width, maintains aspect ratio
      ],
      {
        compress: 0.6, // Good balance between quality and size
        format: ImageManipulator.SaveFormat.JPEG, // JPEG for best compression
        base64: false, // Return URI, not base64
      }
    );
    
    // If we need even smaller files, apply second compression
    const secondCompression = await ImageManipulator.manipulateAsync(
      firstCompression.uri,
      [
        { resize: { width: 600 } }, // Even smaller if needed
      ],
      {
        compress: 0.5, // More aggressive compression
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    
    console.log('✅ Image compressed successfully');
    return secondCompression.uri;
  } catch (error) {
    console.error('❌ Error compressing image:', error);
    // If compression fails, return original URI
    return uri;
  }
};

/**
 * Конвертира URI на изображение към base64 string
 * @param uri - URI от ImagePicker
 * @returns Base64 string с правилен data prefix
 */
export const convertImageToBase64 = async (uri: string): Promise<string> => {
  try {
    // Първо компресираме изображението
    const compressedUri = await compressImage(uri);
    
    // Чете файла като base64
    const base64 = await FileSystem.readAsStringAsync(compressedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // За компресирани изображения използваме JPEG MIME type
    const mimeType = 'image/jpeg';
    
    // Връща правилно форматиран base64 string
    const result = `data:${mimeType};base64,${base64}`;
    
    // Проверява размера
    const sizeKB = Math.round(result.length / 1024);
    console.log(`📏 Final image size: ${sizeKB}KB`);
    
    if (sizeKB > 400) {
      console.warn(`⚠️ Image still large: ${sizeKB}KB - but proceeding...`);
    }
    
    return result;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Грешка при обработка на изображението');
  }
};

/**
 * Валидира дали base64 string е правилно форматиран
 * @param base64String - String за проверка
 * @returns true ако е валиден base64 с data prefix
 */
export const isValidBase64Image = (base64String: string): boolean => {
  return base64String.startsWith('data:image/') && base64String.includes('base64,');
};

/**
 * Проверява дали изображението е Firebase Storage reference
 * @param imageString - String за проверка
 * @returns true ако е Storage reference
 */
export const isFirebaseStorageReference = (imageString: string): boolean => {
  return imageString.length < 100 && (
    imageString.includes('_AgwBNSKOlVPLFgbMpgrD3ZaSKez2') || 
    imageString.startsWith('roadside_cert_') || 
    imageString.startsWith('iaala_license_') || 
    imageString.startsWith('driver_photo_') ||
    /^[a-zA-Z_]+[A-Za-z0-9]{20,}$/.test(imageString)
  );
};

/**
 * Проверява дали изображението е локален file path
 * @param imageString - String за проверка
 * @returns true ако е локален path
 */
export const isLocalFilePath = (imageString: string): boolean => {
  return imageString.startsWith('file://') || 
         imageString.includes('/cache/') || 
         imageString.includes('ExperienceData') ||
         imageString.includes('/storage/') ||
         imageString.includes('/tmp/');
};

/**
 * Проверява дали изображението е base64 без правилен prefix
 * @param imageString - String за проверка
 * @returns true ако е base64 без data URI prefix
 */
export const isBase64WithoutPrefix = (imageString: string): boolean => {
  return imageString.length > 100 && 
         /^[A-Za-z0-9+/]*={0,2}$/.test(imageString) &&
         !imageString.startsWith('data:');
};

/**
 * Анализира image storage формата и връща информация
 * @param imageString - String за анализ
 * @returns Обект с информация за формата
 */
export const analyzeImageFormat = (imageString: string | null | undefined) => {
  if (!imageString) {
    return { type: 'missing', isValid: false, canDisplay: false };
  }

  if (isValidBase64Image(imageString)) {
    return { 
      type: 'base64_valid', 
      isValid: true, 
      canDisplay: true,
      description: 'Valid base64 with data URI prefix'
    };
  }

  if (isFirebaseStorageReference(imageString)) {
    return { 
      type: 'storage_reference', 
      isValid: false, 
      canDisplay: false,
      description: 'Firebase Storage reference - needs authentication fix'
    };
  }

  if (isLocalFilePath(imageString)) {
    return { 
      type: 'local_path', 
      isValid: false, 
      canDisplay: false,
      description: 'Local file path - not accessible in web browsers'
    };
  }

  if (isBase64WithoutPrefix(imageString)) {
    return { 
      type: 'base64_no_prefix', 
      isValid: false, 
      canDisplay: true,
      description: 'Base64 data without proper data URI prefix'
    };
  }

  return { 
    type: 'unknown', 
    isValid: false, 
    canDisplay: false,
    description: 'Unknown format'
  };
};

/**
 * Опитва да поправи base64 без prefix като добави правилен data URI
 * @param base64String - Base64 string без prefix
 * @param imageType - Тип изображение (по подразбиране JPEG)
 * @returns Base64 с правилен data URI prefix
 */
export const fixBase64WithoutPrefix = (base64String: string, imageType: string = 'jpeg'): string => {
  if (isValidBase64Image(base64String)) {
    return base64String; // Вече е правилно форматиран
  }

  if (isBase64WithoutPrefix(base64String)) {
    return `data:image/${imageType};base64,${base64String}`;
  }

  throw new Error('Not a valid base64 string');
};

/**
 * Анализира документите на потребител и връща обобщен доклад
 * @param userDocuments - Документи от потребителския профил
 * @returns Обобщен анализ на всички изображения
 */
export const analyzeUserDocuments = (userDocuments: { 
  roadsideAssistanceCert?: string;
  iaalaLicense?: string;
  driverPhoto?: string;
}) => {
  const analysis: Record<string, any> = {};
  let hasIssues = false;
  let fixableIssues = 0;

  for (const [docType, imageString] of Object.entries(userDocuments)) {
    if (imageString) {
      const format = analyzeImageFormat(imageString);
      analysis[docType] = format;
      
      if (!format.isValid) {
        hasIssues = true;
        if (format.type === 'base64_no_prefix') {
          fixableIssues++;
        }
      }
    } else {
      analysis[docType] = { type: 'missing', isValid: false, canDisplay: false };
    }
  }

  return {
    analysis,
    hasIssues,
    fixableIssues,
    summary: {
      total: Object.keys(userDocuments).length,
      valid: Object.values(analysis).filter(a => a.isValid).length,
      fixable: fixableIssues,
      problematic: Object.values(analysis).filter(a => !a.isValid && a.type !== 'missing').length
    }
  };
};

/**
 * Опитва да поправи всички fixable изображения в потребителските документи
 * @param userDocuments - Документи от потребителския профил
 * @returns Поправени документи (само ако има промени)
 */
export const fixUserDocuments = (userDocuments: { 
  roadsideAssistanceCert?: string;
  iaalaLicense?: string;
  driverPhoto?: string;
}) => {
  const fixedDocuments: Record<string, string> = {};
  let hasChanges = false;

  for (const [docType, imageString] of Object.entries(userDocuments)) {
    if (!imageString) continue;

    const format = analyzeImageFormat(imageString);
    
    if (format.type === 'base64_no_prefix') {
      try {
        const fixed = fixBase64WithoutPrefix(imageString);
        fixedDocuments[docType] = fixed;
        hasChanges = true;
        console.log(`✅ Fixed ${docType}: added data URI prefix`);
      } catch (error) {
        console.warn(`⚠️ Could not fix ${docType}:`, error);
      }
    } else if (format.isValid) {
      fixedDocuments[docType] = imageString; // Keep valid ones as-is
    } else {
      console.warn(`⚠️ Cannot automatically fix ${docType}: ${format.description}`);
    }
  }

  return { fixedDocuments: hasChanges ? fixedDocuments : null, hasChanges };
};

/**
 * Конвертира масив от изображения към base64
 * @param images - Обект с URI на изображения
 * @returns Обект със същите ключове но base64 стойности
 */
export const convertImagesToBase64 = async (images: {
  roadsideAssistanceCert?: string;
  iaalaLicense?: string;
  driverPhoto?: string;
}): Promise<{
  roadsideAssistanceCert?: string;
  iaalaLicense?: string;
  driverPhoto?: string;
}> => {
  const converted: any = {};
  
  for (const [key, uri] of Object.entries(images)) {
    if (uri) {
      try {
        converted[key] = await convertImageToBase64(uri);
        // Log only the length, not the full base64 string to avoid console flooding
        console.log(`✅ Converted ${key} to base64 (${Math.round(converted[key].length / 1024)}KB)`);
      } catch (error) {
        console.error(`❌ Failed to convert ${key}:`, error);
        throw new Error(`Грешка при обработка на ${key}`);
      }
    }
  }
  
  return converted;
}; 