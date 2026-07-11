import type { Rating } from '../domain/types';

type RatingButtonsProps = {
  disabled?: boolean;
  onRate: (rating: Rating) => void;
};

export function RatingButtons({ disabled = false, onRate }: RatingButtonsProps) {
  return (
    <div className="rating-buttons" aria-label="기억 상태 평가">
      <button className="rating rating--weak" type="button" disabled={disabled} onClick={() => onRate('weak')}>모름</button>
      <button className="rating rating--uncertain" type="button" disabled={disabled} onClick={() => onRate('uncertain')}>헷갈림</button>
      <button className="rating rating--strong" type="button" disabled={disabled} onClick={() => onRate('strong')}>기억남</button>
    </div>
  );
}
