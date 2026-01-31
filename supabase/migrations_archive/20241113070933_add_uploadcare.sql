insert into
  public.api_vendors (id, name, description, created_at)
values
  (
    3,
    'Uploadcare',
    'File storage service',
    now()
  );



INSERT INTO public.api_type (
  id,
  vendor_id,
  name,
  description,
  price,
  currency,
  created_at
) VALUES (
  23,
  3,
  'uploadcare',
  '파일 형식
    - 원본 이미지 1200x1200 95% 압축
    - 일반 이미지 /preview/734x734/
    - 썸네일 이미지 /-/preview/734x734/-/format/auto/-/quality/smart/-/scale_crop/300x300/smart_faces_objects_points/center/-/grayscale
    
    원가 산정 기준
     - 오퍼레이션 비용 : 파일당 3건 발생 → $0.00135
     - 스토리지 비용 $0.000439/MB 
     - 다운로드 횟수와 상관없이 1회 적용
     - 다운로드 비용 10회 가정 $0.00439
    
    총 비용  $0.006179/MB',
  0.006179,
  'USD',
  '2024-11-13'
);