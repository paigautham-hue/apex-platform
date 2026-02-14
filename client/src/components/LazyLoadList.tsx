import * as ReactWindow from "react-window";

const List = (ReactWindow as any).FixedSizeList;

interface LazyLoadListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
}

export function LazyLoadList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  keyExtractor,
}: LazyLoadListProps<T>) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    if (!item) return null;

    return (
      <div style={style} key={keyExtractor(item, index)}>
        {renderItem(item, index)}
      </div>
    );
  };

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
    >
      {Row}
    </List>
  );
}
