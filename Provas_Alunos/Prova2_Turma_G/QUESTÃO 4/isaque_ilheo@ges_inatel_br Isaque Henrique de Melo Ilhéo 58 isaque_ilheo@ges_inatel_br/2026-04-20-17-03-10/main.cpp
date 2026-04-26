#include <iostream>
#include <cstring>
using namespace std;

int main()
{
    double num[100], x;
    int i = 0, enc = -1;
    
    cin >> num[i];
    
    while(num[i] != 0)
    {
        i++;
        cin >> num[i];
    }
    
    cin >> x;
    
    for(int j = 0; j <= i; j++)
    {
        if(num[j] == x)
        {
            enc = j;
        }
    }
    
    if(x == 0)
    {
        cout << "Elemento nao encontrado" << endl;
    }
    else if(enc > -1)
    {
        cout << x << " encontrado na posicao " << enc << endl;
    }
    else
    {
        cout << "Elemento nao encontrado" << endl;
    }
    
    return 0;
}