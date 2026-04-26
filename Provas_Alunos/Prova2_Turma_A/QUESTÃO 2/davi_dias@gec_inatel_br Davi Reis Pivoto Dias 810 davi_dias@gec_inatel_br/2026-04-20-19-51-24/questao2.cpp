#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main ()
{
    int numeroX;
    
    cin >> numeroX;
    
    for (int i = 0; i <= numeroX; i++)
    {
        if (i % 2 != 0)
        {
            cout << i << " ";
        }
    }
    
    
    return 0;
}