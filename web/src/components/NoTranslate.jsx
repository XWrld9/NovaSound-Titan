/**
 * NoTranslate — NovaSound TITAN LUX v4
 *
 * Technique CSS content:attr(data-ns) :
 *  • L'élément est VIDE dans le DOM (aucun nœud texte à traduire)
 *  • CSS affiche le texte via ::before { content: attr(data-ns) }
 *  • Elfsight/Google Translate ne traduisent que les nœuds texte DOM
 *
 * Robustesse v4 :
 *  • Si children n'est pas une string, on extrait le texte proprement
 *  • Jamais de [object Object]
 */
import React from 'react';

function toText(children) {
  if (children == null) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (typeof children === 'boolean') return '';
  // React element → ne pas afficher [object Object]
  if (typeof children === 'object') {
    // Array de children
    if (Array.isArray(children)) {
      return children.map(toText).join('');
    }
    // React element avec props.children (ex: <span>{song.title}</span>)
    if (children.props?.children != null) {
      return toText(children.props.children);
    }
    return '';
  }
  return String(children);
}

const NoTranslate = ({
  children,
  tag = 'span',
  className = '',
  style = {},
  onClick,
  title,
}) => {
  const text = toText(children);
  const Tag = tag;
  const isBlock = ['p','h1','h2','h3','h4','h5','h6','div','li'].includes(tag);

  return (
    <Tag
      className={`${isBlock ? 'ns-notrans-block' : 'ns-notrans'} ${className}`}
      style={style}
      onClick={onClick}
      title={title || text}
      data-ns={text}
      translate="no"
      aria-label={text}
    />
  );
};

export default NoTranslate;
