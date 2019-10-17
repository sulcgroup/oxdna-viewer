import matplotlib.cm as cm
import matplotlib.colors as clr 
import numpy as np

cmaps = ['viridis', 'plasma', 'inferno', 'magma', 'cividis',
            'Greys', 'Purples', 'Blues', 'Greens', 'Oranges', 'Reds',
            'YlOrBr', 'YlOrRd', 'OrRd', 'PuRd', 'RdPu', 'BuPu',
            'GnBu', 'PuBu', 'YlGnBu', 'PuBuGn', 'BuGn', 'YlGn',
            'binary', 'gist_yarg', 'gist_gray', 'gray', 'bone', 'pink',
            'spring', 'summer', 'autumn', 'winter', 'cool', 'Wistia',
            'hot', 'afmhot', 'gist_heat', 'copper',
            'PiYG', 'PRGn', 'BrBG', 'PuOr', 'RdGy', 'RdBu',
            'RdYlBu', 'RdYlGn', 'Spectral', 'coolwarm', 'bwr', 'seismic',
            'twilight', 'twilight_shifted', 'hsv',
            'Pastel1', 'Pastel2', 'Paired', 'Accent',
            'Dark2', 'Set1', 'Set2', 'Set3',
            'tab10', 'tab20', 'tab20b', 'tab20c',
            'flag', 'prism', 'ocean', 'gist_earth', 'terrain', 'gist_stern',
            'gnuplot', 'gnuplot2', 'CMRmap', 'cubehelix', 'brg',
            'gist_rainbow', 'rainbow', 'jet', 'nipy_spectral', 'gist_ncar']

gradient = np.linspace(0, 1, 5)

for c in cmaps:
    cmap = cm.get_cmap(c)
    if cmap.N == 256:
        print("\"{}\":\t[ [ 0.0, \'{}\' ], [ 0.2, \'{}\' ], [ 0.5, \'{}\' ], [ 0.8, \'{}\' ],  [ 1.0, \'{}\' ] ],".format(c, clr.to_hex(cmap(0)), clr.to_hex(cmap(51)), clr.to_hex(cmap(102)), clr.to_hex(cmap(153)), clr.to_hex(cmap(204)), clr.to_hex(cmap(255))))