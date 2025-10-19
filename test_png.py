from PIL import Image
import os

def resize_to_640x400(input_path, output_path):
    """
    将JPEG图片调整为640x400像素
    :param input_path: 原始图片路径
    :param output_path: 处理后图片保存路径
    """
    try:
        # 打开图片（支持JPEG格式）
        with Image.open(input_path) as img:
            # 如果图片有透明通道，转换为RGB模式
            if img.mode in ('RGBA', 'LA', 'P'):
                # 创建白色背景
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
                
            # 调整尺寸为640x400，使用抗锯齿缩放
            resized_img = img.resize((640, 400), Image.Resampling.LANCZOS)
            # 保存为JPEG格式（高质量）
            resized_img.save(output_path, format="JPEG", quality=95)
        print(f"成功保存到: {output_path}")
    except Exception as e:
        print(f"处理失败: {e}")

# 使用示例
if __name__ == "__main__":
    # 要转换的图片列表
    images_to_convert = ["g1.jpeg", "g2.jpeg"]
    
    for input_image in images_to_convert:
        # 检查文件是否存在
        if not os.path.exists(input_image):
            print(f"❌ 文件不存在: {input_image}")
            continue
            
        # 生成输出文件名
        base_name = input_image.replace(".jpeg", "").replace(".jpg", "")
        output_image = f"{base_name}_640x400.jpeg"
        
        print(f"🔄 正在转换: {input_image} -> {output_image}")
        resize_to_640x400(input_image, output_image)
