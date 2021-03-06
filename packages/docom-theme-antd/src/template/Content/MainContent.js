import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
    Row, Col, Menu, Icon, Affix,
} from 'antd';
import classNames from 'classnames';
import * as R from 'ramda';
import get from 'lodash/get';
import NProgress from 'nprogress';

import LoadingPage from './LoadingPage';
import Article from './Article';
import ComponentDoc from './ComponentDoc';
import PrevAndNext from './PrevAndNext';
import NotFound from '../NotFound';
import * as utils from '../utils';

const { SubMenu } = Menu;

/**
 * 获取侧边栏选中状态的菜单
 * @param {Props} props
 * @return
 */
function getActiveMenuItem(props) {
    const { location: { pathname } } = props;
    return pathname;
}

function getModuleName(pathname) {
    return pathname
        .replace(/(^\/|\/$)/g, '')
        .split('/')[0];
}

/**
 * 获取模块数据
 * @param {Props} props
 * @return {Array<ModuleItem>}
 */
function getModuleData(props) {
    const { source } = props;
    const { pathname } = props.location;
    const moduleName = getModuleName(pathname);
    const moduleData = Object.keys(source[moduleName]).map((item) => {
        const data = source[moduleName][item];
        if (data.meta) {
            return data;
        }
        return data.index;
    });
    return moduleData;
}

/**
 * 获取侧边栏展开状态的菜单
 * @param {Props} nextProps
 * @return {Array<string>}
 */
const getSideBarOpenKeys = (nextProps) => {
    const { themeConfig = {} } = nextProps;
    const { pathname } = nextProps.location;
    const locale = utils.isZhCN(pathname) ? 'zh-CN' : 'en-US';
    const moduleData = getModuleData(nextProps);
    const shouldOpenKeys = utils
        .getMenuItems(moduleData, locale, themeConfig.categoryOrder, themeConfig.typeOrder)
        .map(m => (m.title && m.title[locale]) || m.title);
    return shouldOpenKeys;
};

export default class MainContent extends Component {
    static getDerivedStateFromProps(props, state) {
        if (!state.openKeys) {
            return {
                ...state,
                openKeys: getSideBarOpenKeys(props),
            };
        }
        return null;
    }

    constructor(props) {
        super(props);

        this.state = {
            openKeys: undefined,
            loading: true,
            content: null,
            demos: [],
            nkey: null,
        };
    }

    componentDidMount() {
        const { nkey } = this.state;
        const { history } = this.props;
        this.updatePage();
        this.listener = history.listen((route) => {
            if (route.pathname !== nkey) {
                NProgress.start();
                const p = this.updatePage(route.pathname);
                if (p) {
                    p.then(() => {
                        NProgress.done();
                    });
                } else {
                    NProgress.done();
                }
            }
        });
    }

    componentDidUpdate(prevProps) {
        const { location } = this.props;
        const { location: prevLocation = {} } = prevProps || {};
        if (!prevProps || prevLocation.pathname !== location.pathname) {
            this.bindScroller();
        }
        if (!window.location.hash && prevLocation.pathname !== location.pathname) {
            document.documentElement.scrollTop = 0;
        }
        // when subMenu not equal
        const pathnameKeys = 'location.pathname';
        if (get(this.props, pathnameKeys) !== get(prevProps, pathnameKeys)) {
            const keys = getSideBarOpenKeys(this.props);
            // reset menu OpenKeys
            this.handleMenuOpenChange(keys);
        }
        setTimeout(() => {
            if (!window.location.hash) {
                return;
            }
            const element = document.getElementById(
                decodeURIComponent(window.location.hash.replace('#', '')),
            );
            if (element && document.documentElement.scrollTop === 0) {
                element.scrollIntoView();
            }
        }, 0);
    }

    componentWillUnmount() {
        if (this.scroller) {
            this.scroller.disable();
        }
        if (this.listener) {
            // this.listener.unlisten();
        }
    }

    /**
   * 生成侧边菜单
   * @param {*} footerNavIcons
   */
    getMenuItems(footerNavIcons = {}) {
        const { locale, themeConfig = {} } = this.props;
        const moduleData = getModuleData(this.props);
        const menuItems = utils.getMenuItems(
            moduleData,
            locale,
            themeConfig.categoryOrder,
            themeConfig.typeOrder,
        );
        return menuItems.map((menuItem) => {
            if (menuItem.children) {
                return (
                    <SubMenu title={<h4>{menuItem.title}</h4>} key={menuItem.title}>
                        {menuItem.children.map((child) => {
                            if (child.type === 'type') {
                                return (
                                    <Menu.ItemGroup title={child.title} key={child.title}>
                                        {child.children
                                            .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0))
                                            .map(leaf => this.generateMenuItem(false, leaf, footerNavIcons))}
                                    </Menu.ItemGroup>
                                );
                            }
                            return this.generateMenuItem(false, child, footerNavIcons);
                        })}
                    </SubMenu>
                );
            }
            return this.generateMenuItem(true, menuItem, footerNavIcons);
        });
    }

    getFooterNav(menuItems, activeMenuItem) {
        const menuItemsList = this.flattenMenu(menuItems);
        let activeMenuItemIndex = -1;
        menuItemsList.forEach((menuItem, i) => {
            if (menuItem && menuItem.key === activeMenuItem) {
                activeMenuItemIndex = i;
            }
        });
        const prev = menuItemsList[activeMenuItemIndex - 1];
        const next = menuItemsList[activeMenuItemIndex + 1];
        return { prev, next };
    }

    updatePage = (path) => {
        this.setState({
            demos: [],
            // content: [],
            // api: [],
        });
        // 这部分逻辑作为 collect 公共方法
        const { location: { pathname: prevPathname }, imports } = this.props;
        const pathname = path || prevPathname;
        const paths = pathname.split('/').filter(Boolean);
        let c = R.path(paths, imports);
        if (typeof c === 'object') {
            const indexPaths = paths.concat('index');
            c = R.path(indexPaths, imports);
        }
        // @TODO  404 判断需要优化
        if (c === undefined && pathname !== '/') {
            this.state = {
                error: 404,
            };
            return;
        }
        // 获取 demos
        let demos = null;
        if (paths.includes('index')) {
            const demoPaths = paths.filter(p => p !== 'index').concat('demo');
            demos = R.path(demoPaths, imports);
        }
        // @TODO: 请求可以放一起
        if (demos) {
            Promise.all(Object.keys(demos).map(key => demos[key]()))
                .then((results) => {
                    this.setState({
                        demos: results,
                    });
                });
        }
        return c()
            .then((response) => {
                this.setState({
                    ...response,
                    markdownData: response,
                });
            })
            .catch(() => { })
            .finally(() => {
                this.setState({
                    loading: false,
                });
            });
    }

    handleMenuOpenChange = (openKeys) => {
        this.setState({ openKeys });
    };

    bindScroller() {
        if (this.scroller) {
            this.scroller.disable();
        }
        require('intersection-observer'); // eslint-disable-line
        const scrollama = require('scrollama'); // eslint-disable-line
        this.scroller = scrollama();
        this.scroller
            .setup({
                step: '.markdown > h2, .code-box', // required
                offset: 0,
            })
            .onStepEnter(({ element }) => {
                [].forEach.call(document.querySelectorAll('.toc-affix li a'), (node) => {
                    node.className = ''; // eslint-disable-line
                });
                const currentNode = document.querySelectorAll(`.toc-affix li a[href="#${element.id}"]`)[0];
                if (currentNode) {
                    currentNode.className = 'current';
                }
            });
    }

    /**
     * 生成菜单 react element
     * @param {boolean} isTop
     * @param {ModuleItem} item
     * @param {Object} param
     * @param {boolean | null} param.before
     * @param {boolean | null} param.after
     * @return {ReactElement}
     */
    generateMenuItem(isTop, item, { before = null, after = null }) {
        const {
            intl: { locale },
        } = this.context;
        const key = `/${item.filename.replace(/\.md/, '')}`;
        if (!item.title) {
            return null;
        }
        const title = item.title[locale] || item.title;
        const text = isTop
            ? title
            : [
                <span key="english">{title}</span>,
                <span className="chinese" key="chinese">
                    {item.subtitle}
                </span>,
            ];
        const { disabled } = item;
        const url = `/${item.filename.replace(/\.md$/i, '').toLowerCase()}`;
        const child = !item.link ? (
            <Link
                to={url}
                disabled={disabled}
            >
                {before}
                {text}
                {after}
            </Link>
        ) : (
            <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                disabled={disabled}
                className="menu-item-link-outside"
            >
                {before}
                {text}
                {' '}
                <Icon type="export" />
                {after}
            </a>
        );
        return (
            <Menu.Item key={key.toLowerCase()} disabled={disabled}>
                {child}
            </Menu.Item>
        );
    }

    flattenMenu(menu) {
        if (!menu) {
            return null;
        }
        if (menu.type && menu.type.isMenuItem) {
            return menu;
        }
        if (Array.isArray(menu)) {
            return menu.reduce((acc, item) => acc.concat(this.flattenMenu(item)), []);
        }
        return this.flattenMenu((menu.props && menu.props.children) || menu.children);
    }

    render() {
        const { props } = this;
        const {
            loading, error, openKeys, api, meta, content, toc, demos,
        } = this.state;
        const isInitial = content === null;
        if (error === 404) {
            return <NotFound />;
        }
        if (loading && isInitial) {
            return <LoadingPage />;
        }
        const activeMenuItem = getActiveMenuItem(props);
        const menuItems = this.getMenuItems();
        const menuItemsForFooterNav = this.getMenuItems({
            before: <Icon className="footer-nav-icon-before" type="left" />,
            after: <Icon className="footer-nav-icon-after" type="right" />,
        });
        const { prev, next } = this.getFooterNav(menuItemsForFooterNav, activeMenuItem);
        const mainContainerClass = classNames('main-container', {
            'main-container-component': !!props.demos,
        });

        const menuChild = (
            <Menu
                inlineIndent="40"
                className="aside-container menu-site"
                mode="inline"
                openKeys={openKeys}
                selectedKeys={[activeMenuItem]}
                onOpenChange={this.handleMenuOpenChange}
            >
                {menuItems}
            </Menu>
        );
        return (
            <div className="main-wrapper">
                <Row>
                    <Col xxl={4} xl={5} lg={6} md={24} sm={24} xs={24} className="main-menu">
                        <Affix>
                            <section className="main-menu-inner">{menuChild}</section>
                        </Affix>
                    </Col>
                    <Col xxl={20} xl={19} lg={18} md={24} sm={24} xs={24}>
                        <section className={mainContainerClass}>
                            {(demos && demos.length) ? (
                                <ComponentDoc {...props} doc={{ content, meta, api }} demos={demos} />
                            ) : (
                                <Article
                                    {...props}
                                    content={content}
                                    meta={meta}
                                    api={api}
                                    toc={toc}
                                />
                            )}
                        </section>
                        <PrevAndNext prev={prev} next={next} />
                    </Col>
                </Row>
            </div>
        );
    }
}

MainContent.contextTypes = {
    intl: PropTypes.object.isRequired,
};
