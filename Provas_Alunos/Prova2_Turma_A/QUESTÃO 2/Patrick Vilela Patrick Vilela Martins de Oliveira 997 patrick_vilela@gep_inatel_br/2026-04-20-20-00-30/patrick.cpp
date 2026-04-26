#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main()
{
    int X;
    int i = 0;
    cin >> X;
    while(i <= X)
    {
        if (i % 2 != 0)
        {
            cout << i << " ";
        }
        i++;
    }
    
    return 0;
}