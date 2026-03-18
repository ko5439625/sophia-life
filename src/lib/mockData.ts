import heroBlog from "@/assets/hero-blog.jpg";
import blogTravel from "@/assets/blog-travel.jpg";
import blogFood from "@/assets/blog-food.jpg";
import blogDaily from "@/assets/blog-daily.jpg";
import blogMood from "@/assets/blog-mood.jpg";

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  images: string[];
  tags: string[];
  date: string;
  isPublic: boolean;
}

export const categories = ["전체", "일상", "개발", "여행", "웨딩"];

export const mockPosts: BlogPost[] = [
  {
    id: "1",
    title: "조용한 아침, 커피 한 잔의 여유",
    excerpt: "바쁜 일상 속에서 찾은 작은 평화. 창가에 앉아 햇살을 느끼며 하루를 시작하는 것만으로도 충분히 행복하다.",
    content: "바쁜 일상 속에서 찾은 작은 평화...",
    category: "일상",
    images: [heroBlog, blogDaily],
    tags: ["커피", "아침", "힐링"],
    date: "2026-03-15",
    isPublic: true,
  },
  {
    id: "2",
    title: "프라하의 숨겨진 골목길",
    excerpt: "관광객이 모르는 프라하의 진짜 매력은 좁은 골목 사이에 숨어 있었다.",
    content: "프라하 여행기...",
    category: "여행",
    images: [blogTravel, heroBlog, blogMood],
    tags: ["프라하", "유럽여행", "골목길", "사진"],
    date: "2026-03-10",
    isPublic: true,
  },
  {
    id: "3",
    title: "봄을 닮은 디저트",
    excerpt: "계절의 색을 담은 파티시에의 작품. 한 입 베어물면 봄이 입안에 퍼진다.",
    content: "디저트 이야기...",
    category: "맛집",
    images: [blogFood, blogDaily],
    tags: ["디저트", "카페", "봄"],
    date: "2026-03-08",
    isPublic: true,
  },
  {
    id: "4",
    title: "식물과 함께하는 하루",
    excerpt: "창가에 놓인 작은 화분들이 주는 위안. 매일 조금씩 자라는 모습을 보며 나도 성장한다.",
    content: "일상 이야기...",
    category: "일상",
    images: [blogDaily],
    tags: ["식물", "반려식물", "일상"],
    date: "2026-03-05",
    isPublic: true,
  },
  {
    id: "5",
    title: "노을이 지는 시간",
    excerpt: "하루의 끝, 바다 위로 펼쳐지는 황금빛 물결. 이 순간만큼은 모든 것이 완벽하다.",
    content: "감성 글...",
    category: "감성",
    images: [blogMood, blogTravel],
    tags: ["노을", "바다", "감성", "사진"],
    date: "2026-03-01",
    isPublic: true,
  },
];
