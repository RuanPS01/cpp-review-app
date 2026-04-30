#include <iostream>
using namespace std;

int main()
{
    int n, numeros, count = 0;
    cin >> n;
    
    for(int i = 0; i < n; i++)
    {
        cin >> numeros;
        if (numeros % 3 == 0)
        {
            count++;
        }
    }
    
    cout << count << endl;
    
    return 0;
}