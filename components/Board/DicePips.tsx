interface DicePipsProps {
  value: number;
}

const pips: Record<number, string[]> = {
  1: ['c'],
  2: ['tl', 'br'],
  3: ['tl', 'c', 'br'],
  4: ['tl', 'tr', 'bl', 'br'],
  5: ['tl', 'tr', 'c', 'bl', 'br'],
  6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
};

export default function DicePips({ value }: DicePipsProps) {
  return (
    <div className="pipGrid">
      {pips[value].map((spot) => (
        <span key={spot} className={`pip ${spot}`} />
      ))}
    </div>
  );
}
