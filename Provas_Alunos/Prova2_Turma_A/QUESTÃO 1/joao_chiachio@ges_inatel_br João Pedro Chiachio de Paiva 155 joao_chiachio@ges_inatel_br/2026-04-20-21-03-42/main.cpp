#include <iostream>
#include <iomanip>

using namespace std;

int main ()
{
    int n, r, a;
    float PA = 0, soma = 0, contador = 0;
    cin >> n;
    
    
    for(int i = 0; i < n; i++)
    {
    
    cin >> a;
    cin >> r;
    
    PA = a + r;
    soma += PA;

    cout << soma << " ";
    }

    return 0;
    
}